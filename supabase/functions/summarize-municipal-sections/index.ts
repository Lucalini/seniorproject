// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SectionInput = {
  number?: string;
  heading?: string;
  body?: string;
};

type Body = {
  sections?: SectionInput[];
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

async function callGemini(prompt: string): Promise<string> {
  const apiKey = requiredEnv("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("Empty response from Gemini");
  }
  return text.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ message: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    const supabaseUrl = requiredEnv("URL");
    const serviceRoleKey = requiredEnv("SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let userId: string | null = null;
    if (jwt && jwt !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data: { user }, error: authError } = await sb.auth.getUser(jwt);
      if (authError || !user) {
        return json({ message: "Invalid or expired token. Please log in again." }, 401);
      }
      userId = user.id;
    }

    if (!userId) {
      return json({ message: "Authentication required." }, 401);
    }

    const body = (await req.json()) as Body;
    const sections = Array.isArray(body.sections) ? body.sections : [];

    if (sections.length === 0) {
      return json({ message: "At least one section is required." }, 400);
    }

    let blob = "";
    for (const s of sections) {
      const num = (s.number ?? "").trim();
      const head = (s.heading ?? "").trim();
      const b = (s.body ?? "").trim();
      blob += `\n\n--- Section ${num}${head ? `: ${head}` : ""} ---\n\n${b}`;
    }

    const prompt =
      `You are helping a resident understand the San Luis Obispo Municipal Code.\n` +
      `Read the following code sections and write a clear, plain-English summary that explains what these provisions do, ` +
      `who they affect, and any important requirements or penalties. Avoid dense legalese; be accurate and concise.\n` +
      `Use short paragraphs or bullet points where helpful.\n\n` +
      `CODE SECTIONS:\n${blob}`;

    const summary = await callGemini(prompt);

    return json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ message }, 500);
  }
});
