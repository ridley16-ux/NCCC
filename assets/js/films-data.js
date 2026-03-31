const DEFAULT_MANIFEST_URL = "/assets/data/films/manifest.json";
const FILM_OWNERS = new Set(["rob", "kev", "real", "rewritten"]);
const REWRITTEN_OWNER = "rewritten";
const OWNER_VERSION_SUFFIX = {
  rob: "[Rob’s Version]",
  kev: "[Kev’s Version]"
};
const OWNER_TAG = {
  rob: "Rob’s Film",
  kev: "Kev’s Film",
  real: "Real Film",
  rewritten: "Rewritten Film"
};
const ROB_PLACEHOLDER_POSTER = "/assets/img/posters/robs/blank-rob.webp";
const KEV_PLACEHOLDER_POSTER = "/assets/img/posters/kevs/blank-kev.svg";

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

function normalizeOwner(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return FILM_OWNERS.has(normalized) ? normalized : null;
}

function getFilmTags(film) {
  if (Array.isArray(film?.tags)) return film.tags;
  if (typeof film?.tags === "string") return [film.tags];
  if (typeof film?.tag === "string") return [film.tag];
  return [];
}

export function getFilmOwner(film) {
  if (!film) return "real";
  const explicitOwner = normalizeOwner(
    film.owner
    ?? film.filmOwner
    ?? film.film_owner
    ?? film.rewriteType
    ?? film.rewrite_type
    ?? film.rewriteOwner
    ?? film.rewrite_owner
    ?? film.variant
  );
  if (explicitOwner) return explicitOwner;

  const rawId = String(film.id || "").trim().toLowerCase();
  if (rawId.startsWith("rob-")) return "rob";
  if (rawId.startsWith("kev-")) return "kev";
  if (rawId.startsWith("real-")) return "real";
  if (film.rob === true) return "rob";
  if (film.rewrite === true || film.rewritten === true) return REWRITTEN_OWNER;
  return "real";
}

export function getFilmCategory(film) {
  const owner = String(getFilmOwner(film) || "").toLowerCase();
  if (owner === "rob" || owner === "kev" || owner === REWRITTEN_OWNER) return REWRITTEN_OWNER;
  if (owner === "real") return "real";
  return "real";
}

function hasKevVersionSuffix(title) {
  return /\[(kev['’]s version)\]\s*$/i.test(String(title || "").trim());
}

function hasOwnerVersionSuffix(title, owner) {
  if (owner === "kev") return hasKevVersionSuffix(title);
  if (owner === "rob") return /\[(rob['’]s version)\]\s*$/i.test(String(title || "").trim());
  return false;
}

export function getFilmDisplayTitle(film) {
  const baseTitle = String(film?.title || "").trim();
  if (!baseTitle) return "";
  const owner = getFilmOwner(film);
  const suffix = OWNER_VERSION_SUFFIX[owner];
  if (!suffix) return baseTitle;
  if (hasOwnerVersionSuffix(baseTitle, owner)) return baseTitle;
  return `${baseTitle} ${suffix}`;
}

export function getFilmRosetteMeta(film) {
  const owner = String(getFilmOwner(film) || "").toLowerCase();
  if (owner === "rob") return { label: "Rob’s Film", className: "rob" };
  if (owner === "kev") return { label: "Kev’s Film", className: "kev" };
  return { label: "Real Film", className: "real" };
}

export function getScoreLabelForFilm(film) {
  return getFilmOwner(film) === "kev" ? "Rob’s Score" : "Kev’s Score";
}

export function isRewrittenFilm(film) {
  return getFilmCategory(film) === REWRITTEN_OWNER;
}

export function isEligibleForKevPick(film) {
  return isRewrittenFilm(film);
}

export function getPosterForFilm(film) {
  const owner = getFilmOwner(film);
  const poster = String(film?.poster || "").trim();
  if (owner === "kev") {
    if (!poster || poster === ROB_PLACEHOLDER_POSTER || poster === KEV_PLACEHOLDER_POSTER) {
      return KEV_PLACEHOLDER_POSTER;
    }
  }
  return poster;
}

export function normalizeFilmMetadata(film, sourcePath = "") {
  const normalizedFilm = { ...film };
  normalizedFilm.sourcePath = sourcePath;

  const owner = getFilmOwner({ ...normalizedFilm, sourcePath });
  normalizedFilm.owner = owner;
  normalizedFilm.category = getFilmCategory(normalizedFilm);

  if (normalizedFilm.category === REWRITTEN_OWNER) {
    normalizedFilm.rewriteType = REWRITTEN_OWNER;
    normalizedFilm.rewrite_type = REWRITTEN_OWNER;
  }

  const existingTags = getFilmTags(normalizedFilm)
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .filter((tag) => !["robs film", "rob's film", "rob’s film", "kevs film", "kev's film", "kev’s film", "real film"].includes(tag.toLowerCase()));

  const ownerTag = OWNER_TAG[owner] || OWNER_TAG[normalizedFilm.category];
  normalizedFilm.tags = ownerTag ? [ownerTag, ...existingTags] : existingTags;
  if (ownerTag) normalizedFilm.tag = ownerTag;

  // Backwards compatibility for old consumers while ownership migrates.
  normalizedFilm.rob = owner === "rob";

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
  return films.filter((film) => film.active && isRewrittenFilm(film)).length;
}
