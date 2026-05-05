// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CalendarEventSource = {
  uuid?: string;
  name: string;
  source_type: string;
  url: string;
  committee_key?: string | null;
  default_address: string;
  default_latitude: number;
  default_longitude: number;
};

type WpLink = {
  title?: string;
  url?: string;
  target?: string;
};

type WpEvent = {
  id: number;
  link: string;
  modified_gmt?: string | null;
  title?: { rendered?: string };
  acf?: Record<string, unknown>;
};

type Occurrence = {
  date: Date;
  cancelled: boolean;
  reason?: string;
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

const ASI_SOURCE = "asi_wordpress";
const DEFAULT_IMAGE_PATH = "events/default.png";
const DEFAULT_TIME_ZONE = "America/Los_Angeles";
const DEFAULT_LOOKAHEAD_DAYS = 180;
const DEFAULT_LOOKBACK_DAYS = 14;
const CAL_POLY_COORDS = { lat: 35.301, lng: -120.659 };
const SLO_CITY_HALL_COORDS = { lat: 35.2828, lng: -120.6596 };

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(input: unknown): string {
  if (typeof input !== "string") return "";
  return decodeHtmlEntities(input)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanTitle(rawTitle: unknown): string {
  const title = stripHtml(rawTitle);
  return title
    .replace(/\s*[–-]\s*cancell?ed\s*$/i, "")
    .replace(/\s*cancell?ed\s*$/i, "")
    .trim();
}

function titleIndicatesCancelled(value: unknown): boolean {
  return /\bcancell?ed\b/i.test(stripHtml(value));
}

function extractAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const match = tag.match(re);
  return decodeHtmlEntities(match?.[2] ?? match?.[3] ?? "").trim() || null;
}

async function fetchText(url: string, accept = "text/html"): Promise<{ body: string; finalUrl: string }> {
  const res = await fetch(url, {
    headers: {
      accept,
      "user-agent": "polislo-committee-calendar-sync/1.0 (+https://www.asi.calpoly.edu/)",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fetch failed ${res.status} for ${url}: ${body.slice(0, 300)}`);
  }

  return { body: await res.text(), finalUrl: res.url || url };
}

async function fetchJson<T>(url: string): Promise<T> {
  const { body } = await fetchText(url, "application/json");
  return JSON.parse(body) as T;
}

function findWordpressEventApiUrl(html: string, pageUrl: string): string {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    const title = extractAttr(tag, "title") ?? "";
    const type = extractAttr(tag, "type") ?? "";
    const href = extractAttr(tag, "href");
    if (
      href &&
      /json/i.test(title) &&
      /application\/json/i.test(type) &&
      /\/wp-json\/wp\/v2\/events\//i.test(href)
    ) {
      return new URL(href, pageUrl).toString();
    }
  }

  const postId = html.match(/\bpostid-(\d+)\b/i)?.[1] ?? html.match(/"id"\s*:\s*(\d+)/)?.[1];
  if (postId) {
    const origin = new URL(pageUrl).origin;
    return `${origin}/wp-json/wp/v2/events/${postId}`;
  }

  throw new Error(`Could not find WordPress event JSON endpoint for ${pageUrl}`);
}

function parseUsDateParts(value: unknown): { y: number; m: number; d: number } | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return {
    m: Number(match[1]),
    d: Number(match[2]),
    y: Number(match[3]),
  };
}

function dateOnlyFromParts(parts: { y: number; m: number; d: number }): Date {
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
}

function dateOnlyFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysBetween(a: Date, b: Date): number {
  const ms = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) -
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  return Math.round(ms / 86_400_000);
}

function dateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function compactDateKey(date: Date): string {
  return dateKey(date).replaceAll("-", "");
}

function dayName(date: Date): string {
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getUTCDay()];
}

function startOfWeekMonday(date: Date): Date {
  const out = new Date(date);
  const day = out.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  out.setUTCDate(out.getUTCDate() + offset);
  return out;
}

function currentDateInTimeZone(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return dateOnlyFromParts({ y, m, d });
}

function parseTimeParts(value: unknown): { hour: number; minute: number } | null {
  if (typeof value !== "string") return null;
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridiem = match[3].replaceAll(".", "");
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

function offsetMinutesForTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const value = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = value.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? "0"));
}

function zonedDateTimeToUtc(
  parts: { y: number; m: number; d: number },
  time: { hour: number; minute: number },
  timeZone: string,
): Date {
  const utcGuess = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, time.hour, time.minute));
  const offset = offsetMinutesForTimeZone(utcGuess, timeZone);
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d, time.hour, time.minute) - offset * 60_000);
}

function occurrenceDateTime(
  occurrenceDate: Date,
  time: { hour: number; minute: number },
  timeZone: string,
): Date {
  return zonedDateTimeToUtc(
    {
      y: occurrenceDate.getUTCFullYear(),
      m: occurrenceDate.getUTCMonth() + 1,
      d: occurrenceDate.getUTCDate(),
    },
    time,
    timeZone,
  );
}

function sameOrBefore(a: Date, b: Date): boolean {
  return dateKey(a) <= dateKey(b);
}

function sameOrAfter(a: Date, b: Date): boolean {
  return dateKey(a) >= dateKey(b);
}

function generateOccurrences(acf: Record<string, unknown>, timeZone: string): Occurrence[] {
  const dateTimes = (acf.event_dates_times ?? {}) as Record<string, unknown>;
  const baseParts = parseUsDateParts(dateTimes.departure_date);
  if (!baseParts) return [];

  const baseDate = dateOnlyFromParts(baseParts);
  const recurrenceEnabled = acf.recurrence_enabled === true;
  const recurrence = (acf.recurrence ?? {}) as Record<string, unknown>;
  const repeatEvery = Math.max(Number(recurrence.repeat_every ?? "1") || 1, 1);
  const repeatType = String(recurrence.repeat_type ?? "week").toLowerCase();
  const repeatDays = Array.isArray(recurrence.repeat_days)
    ? new Set(recurrence.repeat_days.map((d) => String(d).toLowerCase()))
    : new Set([dayName(baseDate)]);
  const endDate = parseUsDateParts(recurrence.end_date);
  const recurrenceEnd = recurrenceEnabled && endDate ? dateOnlyFromParts(endDate) : baseDate;

  const byDate = new Map<string, Occurrence>();

  if (!recurrenceEnabled) {
    byDate.set(dateKey(baseDate), { date: baseDate, cancelled: false });
  } else if (repeatType === "day") {
    for (let d = baseDate; sameOrBefore(d, recurrenceEnd); d = addDays(d, 1)) {
      if (daysBetween(baseDate, d) % repeatEvery === 0) {
        byDate.set(dateKey(d), { date: d, cancelled: false });
      }
    }
  } else if (repeatType === "month") {
    for (let d = new Date(baseDate); sameOrBefore(d, recurrenceEnd); d = new Date(Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth() + repeatEvery,
      d.getUTCDate(),
    ))) {
      byDate.set(dateKey(d), { date: d, cancelled: false });
    }
  } else {
    const baseWeek = startOfWeekMonday(baseDate);
    for (let d = baseDate; sameOrBefore(d, recurrenceEnd); d = addDays(d, 1)) {
      const weeksSinceStart = Math.floor(daysBetween(baseWeek, startOfWeekMonday(d)) / 7);
      if (repeatDays.has(dayName(d)) && weeksSinceStart % repeatEvery === 0) {
        byDate.set(dateKey(d), { date: d, cancelled: false });
      }
    }
  }

  const exceptions = Array.isArray(acf.recurrence_exceptions) ? acf.recurrence_exceptions : [];
  for (const item of exceptions) {
    const ex = item as Record<string, unknown>;
    const parts = parseUsDateParts(ex.date);
    if (!parts) continue;

    const d = dateOnlyFromParts(parts);
    const key = dateKey(d);
    const type = String(ex.type ?? "").toLowerCase();
    if (type === "exclude") {
      byDate.set(key, { date: d, cancelled: true, reason: "recurrence_exception" });
    } else if (type === "include") {
      byDate.set(key, { date: d, cancelled: false, reason: "recurrence_exception" });
    }
  }

  return [...byDate.values()].sort((a, b) => daysBetween(a.date, b.date));
}

function isWpLink(value: unknown): value is WpLink {
  return typeof value === "object" && value !== null && typeof (value as WpLink).url === "string";
}

function agendaLinksByDate(acf: Record<string, unknown>, baseDate: Date): Map<string, WpLink> {
  const out = new Map<string, WpLink>();
  const recurrenceAgendas = Array.isArray(acf.recurrence_agenda_links) ? acf.recurrence_agenda_links : [];
  for (const item of recurrenceAgendas) {
    const row = item as Record<string, unknown>;
    const parts = parseUsDateParts(row.date);
    const link = isWpLink(row.link) ? row.link : null;
    if (!parts || !link?.url) continue;
    out.set(dateKey(dateOnlyFromParts(parts)), link);
  }

  const cta = isWpLink(acf.event_register_cta) ? acf.event_register_cta : null;
  if (cta?.url && /agenda|\.pdf(\?|$)/i.test(`${cta.title ?? ""} ${cta.url}`)) {
    out.set(dateKey(baseDate), cta);
  }

  return out;
}

function imagePathFromAcf(acf: Record<string, unknown>): string {
  const card = acf.event_card_image as Record<string, unknown> | false | undefined;
  const hero = acf.event_hero_image as Record<string, unknown> | false | undefined;
  return String(card && card.url ? card.url : hero && hero.url ? hero.url : DEFAULT_IMAGE_PATH);
}

function linkUrl(link: WpLink | undefined, baseUrl: string): string | null {
  if (!link?.url) return null;
  return new URL(link.url, baseUrl).toString();
}

function buildAddress(acf: Record<string, unknown>, source: CalendarEventSource): string {
  const locationName = stripHtml(acf.event_location_name);
  const locationAddress = stripHtml(acf.event_location_address);
  return [locationName, locationAddress].filter(Boolean).join(", ") || source.default_address;
}

function coordinatesForAddress(address: string, source: CalendarEventSource): { lat: number; lng: number } {
  const lower = address.toLowerCase();
  if (lower.includes("990 palm") || lower.includes("city hall")) {
    return SLO_CITY_HALL_COORDS;
  }
  if (lower.includes("building 0") || lower.includes("university union") || lower.includes("uu")) {
    return CAL_POLY_COORDS;
  }

  const lat = Number(source.default_latitude);
  const lng = Number(source.default_longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return CAL_POLY_COORDS;
}

function buildDescription(args: {
  acf: Record<string, unknown>;
  agendaTitle?: string | null;
  agendaUrl?: string | null;
  status: string;
}): string {
  const parts: string[] = [];
  if (args.status === "cancelled") parts.push("Status: Cancelled");

  const description = stripHtml(args.acf.event_description);
  const details = stripHtml(args.acf.event_details);
  if (description) parts.push(description);
  if (details) parts.push(details);

  const contactName = stripHtml(args.acf.event_contact_name);
  const contactEmail = stripHtml(args.acf.event_contact_email);
  const contactPhone = stripHtml(args.acf.event_contact_phone);
  const contactLines = [
    contactName ? `Contact: ${contactName}` : "",
    contactEmail ? `Email: ${contactEmail}` : "",
    contactPhone ? `Phone: ${contactPhone}` : "",
  ].filter(Boolean);
  if (contactLines.length > 0) parts.push(contactLines.join("\n"));

  if (args.agendaUrl) {
    parts.push(`Agenda\n${args.agendaTitle || "View agenda"}\n${args.agendaUrl}`);
  }

  return parts.join("\n\n").trim();
}

async function fetchWpEventFromSource(sourceUrl: string): Promise<{ event: WpEvent; apiUrl: string; finalUrl: string }> {
  const { body, finalUrl } = await fetchText(sourceUrl);
  const apiUrl = findWordpressEventApiUrl(body, finalUrl);
  const event = await fetchJson<WpEvent>(apiUrl);
  return { event, apiUrl, finalUrl };
}

function sourceFromUrl(url: string, idx: number): CalendarEventSource {
  return {
    name: `Manual URL ${idx + 1}`,
    source_type: "asi_wordpress_event",
    url,
    default_address: "1 Grand Avenue, San Luis Obispo, CA 93407",
    default_latitude: CAL_POLY_COORDS.lat,
    default_longitude: CAL_POLY_COORDS.lng,
    committee_key: null,
  };
}

async function getSources(sb, body: Record<string, unknown>): Promise<CalendarEventSource[]> {
  const urls = Array.isArray(body.urls) ? body.urls.map((u) => String(u).trim()).filter(Boolean) : [];
  if (urls.length > 0) return urls.map(sourceFromUrl);

  const { data, error } = await sb
    .from("calendar_event_sources")
    .select("uuid,name,source_type,url,committee_key,default_address,default_latitude,default_longitude")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(`Could not load calendar sources: ${error.message}`);
  return data ?? [];
}

function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get("COMMITTEE_CALENDAR_CRON_SECRET") ?? Deno.env.get("ASI_CALENDAR_CRON_SECRET") ?? "";
  if (!secret.trim()) return true;
  return req.headers.get("x-cron-secret") === secret;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed" }, 405);
  }

  if (!isAuthorized(req)) {
    return json({ ok: false, message: "Invalid cron secret" }, 401);
  }

  const runStartedAt = new Date().toISOString();

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const timeZone = String(body.timeZone ?? Deno.env.get("ASI_CALENDAR_TIME_ZONE") ?? DEFAULT_TIME_ZONE);
    const lookaheadDays = clampInt(body.lookaheadDays, DEFAULT_LOOKAHEAD_DAYS, 1, 370);
    const lookbackDays = clampInt(body.lookbackDays, DEFAULT_LOOKBACK_DAYS, 0, 90);
    const today = currentDateInTimeZone(timeZone);
    const windowStart = addDays(today, -lookbackDays);
    const windowEnd = addDays(today, lookaheadDays);

    const supabaseUrl = requiredEnv("URL");
    const serviceRoleKey = requiredEnv("SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const sources = await getSources(sb, body as Record<string, unknown>);
    const results = [];
    let upserted = 0;
    let cancelled = 0;
    let skipped = 0;
    let errors = 0;

    for (const source of sources) {
      const sourceResult = {
        name: source.name,
        url: source.url,
        fetched: 0,
        upserted: 0,
        cancelled: 0,
        skipped: 0,
        error: null as string | null,
      };

      if (source.uuid) {
        await sb
          .from("calendar_event_sources")
          .update({ last_checked_at: runStartedAt })
          .eq("uuid", source.uuid);
      }

      try {
        const { event, apiUrl, finalUrl } = await fetchWpEventFromSource(source.url);
        const acf = (event.acf ?? {}) as Record<string, unknown>;
        const dateTimes = (acf.event_dates_times ?? {}) as Record<string, unknown>;
        const baseParts = parseUsDateParts(dateTimes.departure_date);
        const startTime = parseTimeParts(dateTimes.departure_time);
        const endTime = parseTimeParts(dateTimes.return_time);

        if (!baseParts || !startTime || !endTime) {
          throw new Error("Source did not include parseable event date/time fields");
        }

        const baseDate = dateOnlyFromParts(baseParts);
        const baseStart = occurrenceDateTime(baseDate, startTime, timeZone);
        const returnDateParts = parseUsDateParts(dateTimes.return_date) ?? baseParts;
        const baseEnd = zonedDateTimeToUtc(returnDateParts, endTime, timeZone);
        const durationMs = Math.max(baseEnd.getTime() - baseStart.getTime(), 0);
        const occurrences = generateOccurrences(acf, timeZone).filter((occ) =>
          sameOrAfter(occ.date, windowStart) && sameOrBefore(occ.date, windowEnd)
        );
        const agendas = agendaLinksByDate(acf, baseDate);
        const rawTitle = event.title?.rendered ?? source.name;
        const title = cleanTitle(rawTitle) || source.name;
        const pageCancelled = titleIndicatesCancelled(rawTitle) || titleIndicatesCancelled(finalUrl);
        const address = buildAddress(acf, source);
        const coords = coordinatesForAddress(address, source);
        const imagePath = imagePathFromAcf(acf);
        const externalUpdatedAt = event.modified_gmt ? `${event.modified_gmt.replace(" ", "T")}Z` : null;

        for (const occurrence of occurrences) {
          sourceResult.fetched += 1;
          const occurrenceKey = dateKey(occurrence.date);
          const agenda = agendas.get(occurrenceKey);
          const agendaUrl = linkUrl(agenda, event.link || finalUrl);
          const agendaTitle = stripHtml(agenda?.title ?? "");
          const agendaCancelled = titleIndicatesCancelled(agendaTitle);
          const status = occurrence.cancelled || pageCancelled || agendaCancelled ? "cancelled" : "scheduled";
          const startsAt = occurrenceDateTime(occurrence.date, startTime, timeZone);
          const endsAt = new Date(startsAt.getTime() + durationMs);
          const description = buildDescription({
            acf,
            agendaTitle: agendaTitle || null,
            agendaUrl,
            status,
          });

          const { error } = await sb.rpc("upsert_imported_event", {
            p_external_event_uid: `${ASI_SOURCE}:${event.id}:${compactDateKey(occurrence.date)}`,
            p_source: ASI_SOURCE,
            p_source_url: event.link || finalUrl,
            p_title: title,
            p_description: description,
            p_datetime: startsAt.toISOString(),
            p_end_datetime: endsAt.toISOString(),
            p_address: address,
            p_latitude: coords.lat,
            p_longitude: coords.lng,
            p_image_path: imagePath,
            p_status: status,
            p_agenda_url: agendaUrl,
            p_agenda_title: agendaTitle || null,
            p_agenda_text: agendaUrl ? `${agendaTitle || "Agenda"}\n${agendaUrl}` : null,
            p_external_updated_at: externalUpdatedAt,
            p_committee_key: source.committee_key ?? null,
            p_source_raw: {
              sourceName: source.name,
              sourceUrl: source.url,
              committeeKey: source.committee_key ?? null,
              finalUrl,
              apiUrl,
              wpEventId: event.id,
              occurrenceDate: occurrenceKey,
              occurrenceReason: occurrence.reason ?? null,
              recurrenceEnabled: acf.recurrence_enabled === true,
            },
          });

          if (error) {
            errors += 1;
            sourceResult.error = error.message;
            continue;
          }

          upserted += 1;
          sourceResult.upserted += 1;
          if (status === "cancelled") {
            cancelled += 1;
            sourceResult.cancelled += 1;
          }
        }

        if (occurrences.length === 0) {
          skipped += 1;
          sourceResult.skipped += 1;
        }

        if (source.uuid) {
          await sb
            .from("calendar_event_sources")
            .update({
              last_success_at: new Date().toISOString(),
              last_error: sourceResult.error,
            })
            .eq("uuid", source.uuid);
        }
      } catch (err) {
        errors += 1;
        sourceResult.error = err instanceof Error ? err.message : String(err);
        if (source.uuid) {
          await sb
            .from("calendar_event_sources")
            .update({ last_error: sourceResult.error })
            .eq("uuid", source.uuid);
        }
      }

      results.push(sourceResult);
    }

    return json({
      ok: errors === 0,
      runStartedAt,
      timeZone,
      windowStart: dateKey(windowStart),
      windowEnd: dateKey(windowEnd),
      checked: sources.length,
      upserted,
      cancelled,
      skipped,
      errors,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ ok: false, runStartedAt, error: message }, 500);
  }
});
