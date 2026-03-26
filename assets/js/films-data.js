const DEFAULT_MANIFEST_URL = "/assets/data/films/manifest.json";
const REWRITE_TYPES = new Set(["rob", "kev"]);
const KEV_VERSION_SUFFIX = "[Kev’s Version]";

function getPodcastedAtValue(film) {
  if (!film) return null;
  return film.podcasted_at
    ?? film.podcastedAt
    ?? film.podcastDate
    ?? film.published_at
    ?? film.publishedAt
    ?? film.date
    ?? null;
}

function parsePodcastDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const numericDate = new Date(value);
    return Number.isNaN(numericDate.getTime()) ? null : numericDate;
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const ukShortDateMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (ukShortDateMatch) {
    const [, day, month, shortYear] = ukShortDateMatch;
    const fullYear = 2000 + Number(shortYear);
    const date = new Date(fullYear, Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const isoDateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnlyMatch) {
    const [, year, month, day] = isoDateOnlyMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (!/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return null;
  const isoDateTime = new Date(trimmed);
  return Number.isNaN(isoDateTime.getTime()) ? null : isoDateTime;
}

export function isFilmLive(podcastDate, { includeFuture = false } = {}) {
  const date = parsePodcastDateTime(podcastDate);
  if (!date) return true;
  if (includeFuture) return true;
  return date.getTime() <= Date.now();
}

function normalizeRewriteType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return REWRITE_TYPES.has(normalized) ? normalized : null;
}

function detectRewriteTypeFromPath(path) {
  const normalizedPath = String(path || "").toLowerCase();
  if (normalizedPath.includes("/films/robs/")) return "rob";
  if (normalizedPath.includes("/films/kevs/")) return "kev";
  if (normalizedPath.includes("/films/real/")) return "real";
  return null;
}

function getFilmTags(film) {
  if (Array.isArray(film?.tags)) return film.tags;
  if (typeof film?.tags === "string") return [film.tags];
  if (typeof film?.tag === "string") return [film.tag];
  return [];
}

export function getFilmCategory(film) {
  if (!film) return "real";

  const bySourcePath = detectRewriteTypeFromPath(film.sourcePath ?? film.source_path);
  if (bySourcePath) return bySourcePath;

  const explicitType = normalizeRewriteType(
    film.rewriteType
    ?? film.rewrite_type
    ?? film.rewriteOwner
    ?? film.rewrite_owner
    ?? film.variant
  );
  if (explicitType) return explicitType;

  const rawId = String(film.id || "").trim().toLowerCase();
  if (rawId.startsWith("rob-")) return "rob";
  if (rawId.startsWith("kev-")) return "kev";
  if (film.rob === true) return "rob";
  return "real";
}

function hasKevVersionSuffix(title) {
  return /\[(kev['’]s version)\]\s*$/i.test(String(title || "").trim());
}

export function getFilmDisplayTitle(film) {
  const baseTitle = String(film?.title || "").trim();
  if (!baseTitle) return "";
  if (getFilmCategory(film) !== "kev") return baseTitle;
  if (hasKevVersionSuffix(baseTitle)) return baseTitle;
  return `${baseTitle} ${KEV_VERSION_SUFFIX}`;
}

export function normalizeFilmMetadata(film, sourcePath = "") {
  const normalizedFilm = { ...film };
  normalizedFilm.sourcePath = sourcePath;

  const category = getFilmCategory({ ...normalizedFilm, sourcePath });
  if (category === "kev") {
    normalizedFilm.rewriteType = "kev";
    normalizedFilm.rewrite_type = "kev";
    normalizedFilm.rob = false;
  } else if (category === "rob") {
    normalizedFilm.rewriteType = "rob";
    normalizedFilm.rewrite_type = "rob";
  }

  const existingTags = getFilmTags(normalizedFilm)
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .filter((tag) => tag.toLowerCase() !== "robs film");

  if (category === "kev") {
    normalizedFilm.tags = ["Kev's Film", ...existingTags.filter((tag) => tag.toLowerCase() !== "kev's film")];
    normalizedFilm.tag = "Kev's Film";
  } else {
    normalizedFilm.tags = existingTags;
  }

  normalizedFilm.displayTitle = getFilmDisplayTitle(normalizedFilm);
  return normalizedFilm;
}

export async function loadFilmsData({ manifestUrl = DEFAULT_MANIFEST_URL, includeFuture = false } = {}) {
  const manifestRes = await fetch(manifestUrl);
  if (!manifestRes.ok) {
    throw new Error("Failed to load films manifest");
  }
  const manifest = await manifestRes.json();
  const entries = Array.isArray(manifest.films) ? manifest.films : [];

  const films = [];
  for (const entry of entries) {
    if (!entry?.path) continue;
    const res = await fetch(entry.path);
    if (!res.ok) {
      continue;
    }
    const rawFilm = await res.json();
    const film = normalizeFilmMetadata(rawFilm, entry.path);
    film.podcasted_at = getPodcastedAtValue(film);
    film.active = Boolean(entry.active) && isFilmLive(film.podcasted_at, { includeFuture });
    films.push(film);
  }

  return films;
}

export async function getRobsFilmsCount(options) {
  const films = await loadFilmsData(options);
  return films.filter((film) => film.active && film.rob).length;
}
