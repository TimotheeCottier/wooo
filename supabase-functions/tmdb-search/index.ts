// =========================================================
// Edge Function Supabase : tmdb-search
// ---------------------------------------------------------
// Proxy CORS-friendly vers l'API TMDB.
// - ?type=movie → /search/movie (films uniquement)
// - ?type=tv    → /search/tv    (séries uniquement)
// - ?type=multi → /search/multi (mélange films + séries, défaut)
// - ?trending=1 → /trending/all/week
// ---------------------------------------------------------
// Déploiement :
//   supabase functions deploy tmdb-search --no-verify-jwt
// (ou via le dashboard)
//
// Variables d'environnement nécessaires :
//   TMDB_API_KEY : clé API v3 TMDB (gratuite sur themoviedb.org)
// =========================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") || "";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!TMDB_API_KEY) {
    return new Response(
      JSON.stringify({ error: "TMDB_API_KEY non configurée" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const url = new URL(req.url);
    const trending = url.searchParams.get("trending") === "1";
    const q = url.searchParams.get("q") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const type = url.searchParams.get("type") || "multi"; // movie, tv, multi

    let endpoint;
    if (trending) {
      endpoint = `${TMDB_BASE}/trending/all/week?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`;
    } else {
      if (!q) {
        return new Response(JSON.stringify({ results: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let searchPath = "search/multi";
      if (type === "movie") searchPath = "search/movie";
      else if (type === "tv") searchPath = "search/tv";

      endpoint = `${TMDB_BASE}/${searchPath}?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(q)}&page=${page}&include_adult=false`;
    }

    const tmdbResp = await fetch(endpoint);
    if (!tmdbResp.ok) {
      return new Response(
        JSON.stringify({ error: "TMDB error: " + tmdbResp.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const data = await tmdbResp.json();
    const rawResults = data.results || [];

    // Normalisation : déterminer si chaque résultat est un film ou une série,
    // selon le type demandé (les endpoints /movie et /tv ne renvoient pas media_type)
    const filtered = rawResults
      .filter((r: any) => r.poster_path)
      .map((r: any) => {
        // Pour /search/movie, c'est forcément un film
        // Pour /search/tv, c'est forcément une série
        // Pour /search/multi, media_type est présent
        let mediaType;
        if (type === "movie") mediaType = "movie";
        else if (type === "tv") mediaType = "tv";
        else mediaType = r.media_type === "tv" ? "tv" : "movie";

        const isMovie = mediaType === "movie";
        const title = isMovie ? r.title : r.name;
        const release = isMovie ? r.release_date : r.first_air_date;
        const year = release ? release.slice(0, 4) : "";
        return {
          id: String(r.id),
          type: isMovie ? "movie" : "tv",
          title: title || "",
          year: year,
          poster: TMDB_IMG_BASE + "/w500" + r.poster_path,
          poster_small: TMDB_IMG_BASE + "/w185" + r.poster_path,
          overview: r.overview || "",
          director: "",
        };
      });

    // Pour la recherche utilisateur, on enrichit les 10 premiers avec le réalisateur
    if (!trending && filtered.length > 0) {
      const toEnrich = filtered.slice(0, 10);
      await Promise.all(toEnrich.map(async (item: any) => {
        try {
          const creditsUrl = `${TMDB_BASE}/${item.type}/${item.id}/credits?api_key=${TMDB_API_KEY}&language=fr-FR`;
          const cResp = await fetch(creditsUrl);
          if (!cResp.ok) return;
          const cData = await cResp.json();
          if (item.type === "movie") {
            const dir = (cData.crew || []).find((c: any) => c.job === "Director");
            item.director = dir ? dir.name : "";
          } else {
            const detUrl = `${TMDB_BASE}/tv/${item.id}?api_key=${TMDB_API_KEY}&language=fr-FR`;
            const detResp = await fetch(detUrl);
            if (detResp.ok) {
              const det = await detResp.json();
              const creators = (det.created_by || []).map((c: any) => c.name);
              item.director = creators.join(", ");
            }
          }
        } catch (_) { /* ignore */ }
      }));
    }

    return new Response(
      JSON.stringify({ results: filtered, page: data.page, total_pages: data.total_pages }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
