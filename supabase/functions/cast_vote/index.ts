import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_VERSION = "cast_vote_v2_debug_2026-02-06";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY environment variable");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://nocontextcinemaclub.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

const filmIdRegex = /^(rob|real)-[a-z0-9-]+$/i;

type VotePayload = {
  film_id: unknown;
  visitor_id: unknown;
  rating: unknown;
};

function errToDetail(err: any) {
  if (!err) return null;
  return {
    message: err.message ?? null,
    details: err.details ?? null,
    hint: err.hint ?? null,
    code: err.code ?? null,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return Response.json(
        { error: "Method not allowed", version: FUNCTION_VERSION },
        { status: 405, headers: corsHeaders }
      );
    }

    let payload: VotePayload;
    try {
      payload = await req.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON body", version: FUNCTION_VERSION },
        { status: 400, headers: corsHeaders }
      );
    }

    const film_id = typeof payload.film_id === "string" ? payload.film_id.trim() : "";
    const visitor_id = typeof payload.visitor_id === "string" ? payload.visitor_id.trim() : "";
    const rating = payload.rating;

    if (!film_id || !filmIdRegex.test(film_id)) {
      return Response.json(
        { error: "Invalid film_id", version: FUNCTION_VERSION },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!visitor_id) {
      return Response.json(
        { error: "Invalid visitor_id", version: FUNCTION_VERSION },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      return Response.json(
        { error: "Invalid rating", version: FUNCTION_VERSION },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: catalogRow, error: catalogError } = await supabase
      .from("film_catalog")
      .select("film_id, kev_percent, active")
      .eq("film_id", film_id)
      .maybeSingle();

    if (catalogError) {
      console.error("catalogError", catalogError);
      return Response.json(
        { error: "Failed to check film catalog", detail: errToDetail(catalogError), version: FUNCTION_VERSION },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!catalogRow || !catalogRow.active) {
      return Response.json(
        { error: "Unknown or inactive film", version: FUNCTION_VERSION },
        { status: 400, headers: corsHeaders }
      );
    }

    const { error: metaError } = await supabase
      .from("film_meta")
      .upsert({ film_id, kev_percent: catalogRow.kev_percent }, { onConflict: "film_id" });

    if (metaError) {
      console.error("metaError", metaError);
      return Response.json(
        { error: "Failed to ensure film baseline", detail: errToDetail(metaError), version: FUNCTION_VERSION },
        { status: 500, headers: corsHeaders }
      );
    }

    const { error: voteError } = await supabase
      .from("film_votes")
      .upsert({ film_id, visitor_id, rating }, { onConflict: "film_id,visitor_id" });

    if (voteError) {
      console.error("voteError", voteError);
      return Response.json(
        { error: "Failed to store vote", detail: errToDetail(voteError), version: FUNCTION_VERSION },
        { status: 500, headers: corsHeaders }
      );
    }

    const { data: scoreRow, error: scoreError } = await supabase
      .from("film_scores_v1")
      .select("film_id, weighted_percent, listener_count")
      .eq("film_id", film_id)
      .maybeSingle();

    if (scoreError || !scoreRow) {
      console.error("scoreError", scoreError);
      return Response.json(
        { error: "Failed to fetch updated score", detail: errToDetail(scoreError), version: FUNCTION_VERSION },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        film_id: scoreRow.film_id,
        weighted_percent: scoreRow.weighted_percent,
        listener_count: scoreRow.listener_count,
        version: FUNCTION_VERSION,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (unhandled) {
    console.error("UNHANDLED_ERROR", unhandled);
    return Response.json(
      { error: "Unhandled server error", detail: String(unhandled), version: FUNCTION_VERSION },
      { status: 500, headers: corsHeaders }
    );
  }
});
