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

function parseLocalDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isFilmLive(podcastDate) {
  const date = parseLocalDate(podcastDate);
  if (!date) return true;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date.getTime() <= todayStart.getTime();
}

export async function loadFilmsData({ manifestUrl = DEFAULT_MANIFEST_URL } = {}) {
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
    film.active = Boolean(entry.active) && isFilmLive(film.podcasted_at);
    films.push(film);
  }

  return films;
}

export async function getRobsFilmsCount(options) {
  const films = await loadFilmsData(options);
  return films.filter((film) => film.active && film.rob).length;
}
