const DEFAULT_MANIFEST_URL = "/assets/data/films/manifest.json";

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
    const film = await res.json();
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
