// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type MobilizeTimeslot = {
  id: number;
  start_date: number; // unix seconds
  end_date: number; // unix seconds
  instructions: string | null;
  is_full?: boolean;
};

type MobilizeLocation = {
  venue?: string;
  address_lines?: string[];
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  location?: { latitude: number; longitude: number } | null;
};

type MobilizeEvent = {
  title: string;
  description?: string | null;
  summary?: string | null;
  featured_image_url?: string | null;
  browser_url?: string | null;
  sponsor?: { id: number; name: string } | null;
  timeslots?: MobilizeTimeslot[] | null;
  location?: MobilizeLocation | null;
  is_virtual?: boolean | null;
};

type MobilizeListResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  data?: MobilizeEvent[] | null;
  results_limited_to?: number | null;
};

function requiredEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function formatAddress(loc: MobilizeLocation): string {
  const parts: string[] = [];
  const line1 = (loc.address_lines?.[0] ?? "").trim();
  const line2 = (loc.address_lines?.[1] ?? "").trim();
  if (line1) parts.push(line1);
  if (line2) parts.push(line2);

  const city = (loc.locality ?? "").trim();
  const region = (loc.region ?? "").trim();
  const zip = (loc.postal_code ?? "").trim();

  const cityLine = [city, region].filter(Boolean).join(", ");
  const regionZip = [cityLine, zip].filter(Boolean).join(" ");
  if (regionZip) parts.push(regionZip);
  return parts.join(", ");
}

function buildInitialMobilizeUrl(args: {
  zipcode: string;
  maxDistMiles: string;
  perPage: string;
}): string {
  const url = new URL("https://api.mobilize.us/v1/events");
  url.searchParams.set("zipcode", args.zipcode);
  url.searchParams.set("max_dist", args.maxDistMiles);
  url.searchParams.set("timeslot_start", "gte_now");
  url.searchParams.set("exclude_full", "true");
  url.searchParams.set("is_virtual", "false");
  url.searchParams.set("per_page", args.perPage);
  return url.toString();
}

async function fetchAllMobilizeEvents(opts: {
  zipcode: string;
  maxDistMiles: string;
  perPage: string;
  maxPages: number;
}): Promise<MobilizeEvent[]> {
  const out: MobilizeEvent[] = [];
  let nextUrl: string | null = buildInitialMobilizeUrl(opts);
  let pages = 0;

  while (nextUrl) {
    pages += 1;
    if (pages > opts.maxPages) break;

    const res = await fetch(nextUrl, {
      headers: {
        "accept": "application/json",
        "user-agent": "supabase-edge-function (mobilize-slo-scrape)",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Mobilize API error ${res.status}: ${body.slice(0, 500)}`);
    }

    const json = (await res.json()) as MobilizeListResponse;
    const data = json.data ?? [];
    out.push(...data);
    nextUrl = json.next ?? null;
  }

  return out;
}

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = requiredEnv("URL");
    const serviceKey = requiredEnv("SERVICE_ROLE_KEY");

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const zipcode = Deno.env.get("MOBILIZE_ZIPCODE") ?? "93401";
    const maxDistMiles = Deno.env.get("MOBILIZE_MAX_DIST_MILES") ?? "50";
    const perPage = Deno.env.get("MOBILIZE_PER_PAGE") ?? "50";
    const maxPages = Number(Deno.env.get("MOBILIZE_MAX_PAGES") ?? "10");

    const mobilizeEvents = await fetchAllMobilizeEvents({
      zipcode,
      maxDistMiles,
      perPage,
      maxPages,
    });

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const e of mobilizeEvents) {
      const title = (e.title ?? "").trim();
      const timeslots = e.timeslots ?? [];
      const location = e.location ?? null;
      const coords = location?.location ?? null;

      if (!title || !location || !coords) {
        skipped += 1;
        continue;
      }

      const address = formatAddress(location).trim();
      if (!address) {
        skipped += 1;
        continue;
      }

      // Uniqueness rule: if (title, address) already exists, do not insert.
      const { data: existing, error: existingErr } = await sb
        .from("events")
        .select("uuid")
        // Use case-insensitive exact matching to avoid duplicates caused by casing differences.
        .ilike("title", title)
        .ilike("address", address)
        .limit(1);

      if (existingErr) {
        errors += 1;
        continue;
      }
      if ((existing ?? []).length > 0) {
        skipped += 1;
        continue;
      }

      const nextTimeslot = [...timeslots]
        .filter((t) => !t.is_full)
        .sort((a, b) => a.start_date - b.start_date)[0];

      if (!nextTimeslot) {
        skipped += 1;
        continue;
      }

      const dtIso = new Date(nextTimeslot.start_date * 1000).toISOString();
      const signUpUrl = (e.browser_url ?? "").trim();
      const sponsorName = (e.sponsor?.name ?? "").trim();

      const descParts: string[] = [];
      const baseDesc = (e.description ?? e.summary ?? "").trim();
      if (baseDesc) descParts.push(baseDesc);
      if (nextTimeslot.instructions) {
        descParts.push(`Instructions: ${nextTimeslot.instructions.trim()}`);
      }
      if (signUpUrl) descParts.push(`Sign up: ${signUpUrl}`);
      if (sponsorName) descParts.push(`Hosted by: ${sponsorName}`);

      const description = descParts.join("\n\n").trim();
      const imagePath = (e.featured_image_url ?? "").trim() || "events/default.png";

      const { error: insertErr } = await sb.rpc("create_event", {
        p_title: title,
        p_description: description,
        p_datetime: dtIso,
        p_address: address,
        p_latitude: coords.latitude,
        p_longitude: coords.longitude,
        p_image_path: imagePath,
      });

      if (insertErr) {
        errors += 1;
        continue;
      }

      inserted += 1;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        zipcode,
        maxDistMiles,
        fetched: mobilizeEvents.length,
        inserted,
        skipped,
        errors,
      }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});

