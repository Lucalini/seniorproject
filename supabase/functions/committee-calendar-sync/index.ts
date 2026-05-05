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

// InCommon RSA Server CA 2 + USERTrust RSA root certificates.
// The ASI WordPress server (asi.calpoly.edu) uses InCommon certs which are not
// in the Supabase Deno edge runtime's default trust store. We provide the full
// chain here so Deno can verify the TLS connection.
// TODO: Remove once Supabase updates their Deno runtime CA bundle.
const INCOMMON_CA_CHAIN = `-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIFgTCCBGmgAwIBAgIQOXJEOvkit1HX02wQ3TE1lTANBgkqhkiG9w0BAQwFADB7
MQswCQYDVQQGEwJHQjEbMBkGA1UECAwSR3JlYXRlciBNYW5jaGVzdGVyMRAwDgYD
VQQHDAdTYWxmb3JkMRowGAYDVQQKDBFDb21vZG8gQ0EgTGltaXRlZDEhMB8GA1UE
AwwYQUFBIENlcnRpZmljYXRlIFNlcnZpY2VzMB4XDTE5MDMxMjAwMDAwMFoXDTI4
MTIzMTIzNTk1OVowgYgxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpOZXcgSmVyc2V5
MRQwEgYDVQQHEwtKZXJzZXkgQ2l0eTEeMBwGA1UEChMVVGhlIFVTRVJUUlVTVCBO
ZXR3b3JrMS4wLAYDVQQDEyVVU0VSVHJ1c3QgUlNBIENlcnRpZmljYXRpb24gQXV0
aG9yaXR5MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAgBJlFzYOw9sI
s9CsVw127c0n00ytUINh4qogTQktZAnczomfzD2p7PbPwdzx07HWezcoEStH2jnG
vDoZtF+mvX2do2NCtnbyqTsrkfjib9DsFiCQCT7i6HTJGLSR1GJk23+jBvGIGGqQ
Ijy8/hPwhxR79uQfjtTkUcYRZ0YIUcuGFFQ/vDP+fmyc/xadGL1RjjWmp2bIcmfb
IWax1Jt4A8BQOujM8Ny8nkz+rwWWNR9XWrf/zvk9tyy29lTdyOcSOk2uTIq3XJq0
tyA9yn8iNK5+O2hmAUTnAU5GU5szYPeUvlM3kHND8zLDU+/bqv50TmnHa4xgk97E
xwzf4TKuzJM7UXiVZ4vuPVb+DNBpDxsP8yUmazNt925H+nND5X4OpWaxKXwyhGNV
icQNwZNUMBkTrNN9N6frXTpsNVzbQdcS2qlJC9/YgIoJk2KOtWbPJYjNhLixP6Q5
D9kCnusSTJV882sFqV4Wg8y4Z+LoE53MW4LTTLPtW//e5XOsIzstAL81VXQJSdhJ
WBp/kjbmUZIO8yZ9HE0XvMnsQybQv0FfQKlERPSZ51eHnlAfV1SoPv10Yy+xUGUJ
5lhCLkMaTLTwJUdZ+gQek9QmRkpQgbLevni3/GcV4clXhB4PY9bpYrrWX1Uu6lzG
KAgEJTm4Diup8kyXHAc/DVL17e8vgg8CAwEAAaOB8jCB7zAfBgNVHSMEGDAWgBSg
EQojPpbxB+zirynvgqV/0DCktDAdBgNVHQ4EFgQUU3m/WqorSs9UgOHYm8Cd8rID
ZsswDgYDVR0PAQH/BAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8wEQYDVR0gBAowCDAG
BgRVHSAAMEMGA1UdHwQ8MDowOKA2oDSGMmh0dHA6Ly9jcmwuY29tb2RvY2EuY29t
L0FBQUNlcnRpZmljYXRlU2VydmljZXMuY3JsMDQGCCsGAQUFBwEBBCgwJjAkBggr
BgEFBQcwAYYYaHR0cDovL29jc3AuY29tb2RvY2EuY29tMA0GCSqGSIb3DQEBDAUA
A4IBAQAYh1HcdCE9nIrgJ7cz0C7M7PDmy14R3iJvm3WOnnL+5Nb+qh+cli3vA0p+
rvSNb3I8QzvAP+u431yqqcau8vzY7qN7Q/aGNnwU4M309z/+3ri0ivCRlv79Q2R+
/czSAaF9ffgZGclCKxO/WIu6pKJmBHaIkU4MiRTOok3JMrO66BQavHHxW/BBC5gA
CiIDEOUMsfnNkjcZ7Tvx5Dq2+UUTJnWvu6rvP3t3O9LEApE9GQDTF1w52z97GA1F
zZOFli9d31kWTz9RvdVFGD/tSo7oBmF0Ixa1DVBzJ0RHfxBdiSprhTEUxOipakyA
vGp4z7h/jnZymQyd/teRCBaho1+V
-----END CERTIFICATE-----`;

const httpClient = Deno.createHttpClient({ caCerts: [INCOMMON_CA_CHAIN] });

async function fetchText(url: string, accept = "text/html"): Promise<{ body: string; finalUrl: string }> {
  const res = await fetch(url, {
    // @ts-ignore -- Deno-specific option not in lib.dom types
    client: httpClient,
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

/** Weekday for this calendar Y-M-D in `timeZone` (matches ASI WordPress recurrence repeat_days). */
function dayNameInEventZone(date: Date, timeZone: string): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const anchorUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone }).format(anchorUtc).toLowerCase();
}

/** Monday-start week boundary in the event timezone (for repeat_every intervals). */
function startOfWeekMondayInZone(date: Date, timeZone: string): Date {
  const order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const idx = order.indexOf(dayNameInEventZone(date, timeZone));
  if (idx < 0) {
    const out = new Date(date);
    const day = out.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    out.setUTCDate(out.getUTCDate() + offset);
    return out;
  }
  return addDays(date, -idx);
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
  const s = value.trim().toLowerCase();

  const twelve = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)$/i);
  if (twelve) {
    let hour = Number(twelve[1]);
    const minute = Number(twelve[2] ?? "0");
    const meridiem = twelve[3].replaceAll(".", "");
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return { hour, minute };
  }

  const twentyFour = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return { hour, minute };
  }

  return null;
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
    : new Set([dayNameInEventZone(baseDate, timeZone)]);
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
    const baseWeek = startOfWeekMondayInZone(baseDate, timeZone);
    for (let d = baseDate; sameOrBefore(d, recurrenceEnd); d = addDays(d, 1)) {
      const weeksSinceStart = Math.floor(daysBetween(baseWeek, startOfWeekMondayInZone(d, timeZone)) / 7);
      if (repeatDays.has(dayNameInEventZone(d, timeZone)) && weeksSinceStart % repeatEvery === 0) {
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
        let endTime = parseTimeParts(dateTimes.return_time);

        if (!baseParts || !startTime) {
          throw new Error("Source did not include parseable event date/time fields");
        }
        if (!endTime) endTime = startTime;

        const baseDate = dateOnlyFromParts(baseParts);
        const baseStart = occurrenceDateTime(baseDate, startTime, timeZone);
        const returnDateParts = parseUsDateParts(dateTimes.return_date) ?? baseParts;
        const baseEnd = zonedDateTimeToUtc(returnDateParts, endTime, timeZone);
        let durationMs = Math.max(baseEnd.getTime() - baseStart.getTime(), 0);
        if (durationMs === 0) durationMs = 60 * 60 * 1000;
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
