// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CreateEventBody = {
  title?: string;
  datetime?: string;
  address?: string;
  description?: string;
  imagePath?: string;
  organizerId?: string | null;
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

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

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const res = await fetch(url, {
    headers: {
      // Nominatim requires a clear user-agent.
      "user-agent": "polislo-supabase-function-create-event",
      accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Geocoding failed: ${res.status} ${body.slice(0, 200)}`);
  }

  const rows = (await res.json()) as Array<{ lat?: string; lon?: string }>;
  const first = rows[0];
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Could not geocode address: ${address}`);
  }

  return { lat, lng };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ message: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as CreateEventBody;
    const title = (body.title ?? "").trim();
    const datetime = (body.datetime ?? "").trim();
    const address = (body.address ?? "").trim();
    const description = (body.description ?? "").trim();
    const imagePath = (body.imagePath ?? "events/default.png").trim() || "events/default.png";
    const organizerId = body.organizerId ?? null;

    if (!title || !datetime || !address) {
      return json({ message: "title, datetime, and address are required" }, 400);
    }

    const { lat, lng } = await geocodeAddress(address);

    const supabaseUrl = requiredEnv("URL");
    const serviceRoleKey = requiredEnv("SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const rpcPayload: Record<string, unknown> = {
      p_title: title,
      p_description: description,
      p_datetime: datetime,
      p_address: address,
      p_latitude: lat,
      p_longitude: lng,
      p_image_path: imagePath,
    };
    if (organizerId) rpcPayload.p_organizer_id = organizerId;

    const { data, error } = await sb.rpc("create_event", rpcPayload);
    if (error) {
      return json({ message: error.message }, 400);
    }

    const row = (data ?? [])[0];
    if (!row) {
      return json({ message: "Failed to create event" }, 500);
    }

    return json(
      {
        uuid: row.uuid,
        title: row.title,
        description: row.description,
        datetime: row.event_datetime,
        address: row.address,
        imagePath: row.image_path,
        organizerId: row.organizer_id,
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ message }, 500);
  }
});
