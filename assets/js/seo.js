/*
  SEO helpers for No Context Cinema Club.
  - Add the podcast cover at /assets/branding/podcast-cover.webp (update this when the artwork is ready).
*/

const DEFAULT_BASE_URL = "https://nocontextcinemaclub.com/";
const PODCAST_IMAGE = `${DEFAULT_BASE_URL}assets/branding/podcast-cover.webp`;
const PLATFORM_LINKS = [
  "https://open.spotify.com/show/6SE2QpCj42C46AlHfTPd59",
  "https://podcasts.apple.com/us/podcast/no-context-cinema-club/id1875096501"
];

const PLATFORM_HOSTS = [
  "spotify.com",
  "apple.com"
];

function normalizeBaseUrl(baseUrl = DEFAULT_BASE_URL) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function isPlaceholder(value) {
  return /REPLACE/i.test(value);
}

export function isRealUrl(value) {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "#" || isPlaceholder(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function toAbsoluteUrl(value, baseUrl = DEFAULT_BASE_URL) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "#" || isPlaceholder(trimmed)) return null;
  if (isRealUrl(trimmed)) return trimmed;
  const normalizedBase = normalizeBaseUrl(baseUrl);
  if (trimmed.startsWith("/")) return `${normalizedBase}${trimmed.slice(1)}`;
  if (trimmed.startsWith("./")) return `${normalizedBase}${trimmed.slice(2)}`;
  return `${normalizedBase}${trimmed}`;
}

function isValidDateString(value) {
  if (!value || typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
}

function isPlatformPodcastLink(value) {
  if (!isRealUrl(value)) return false;
  try {
    const host = new URL(value).hostname;
    return PLATFORM_HOSTS.some((platform) => host.includes(platform));
  } catch (error) {
    return false;
  }
}

export function buildPodcastSeriesSchema({ pageTitle, pageDescription, pageUrl }) {
  const baseUrl = normalizeBaseUrl(DEFAULT_BASE_URL);
  const description = pageDescription || "No Context Cinema Club is a film podcast where Rob rewrites plots and Kev reacts.";
  const sameAsCandidates = PLATFORM_LINKS.filter((link) => isRealUrl(link));
  const sameAs = sameAsCandidates.length ? [baseUrl, ...sameAsCandidates] : [baseUrl];

  return {
    "@context": "https://schema.org",
    "@type": "PodcastSeries",
    "@id": `${baseUrl}#podcast`,
    name: "No Context Cinema Club",
    url: baseUrl,
    inLanguage: "en-GB",
    description,
    image: PODCAST_IMAGE,
    publisher: {
      "@type": "Organization",
      name: "No Context Cinema Club",
      url: baseUrl
    },
    author: [
      { "@type": "Person", name: "Rob" },
      { "@type": "Person", name: "Kev" }
    ],
    sameAs
  };
}

export function buildPodcastEpisodeSchemaFromFilm(film, { baseUrl = DEFAULT_BASE_URL } = {}) {
  if (!film || !film.id || !film.title) return null;
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const description = film.summary?.trim() || "Episode coming soon.";
  const schema = {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    "@id": `${normalizedBase}films/${film.id}#episode`,
    name: `${film.title} – No Context Cinema Club`,
    description,
    url: `${normalizedBase}#${film.id}`,
    partOfSeries: {
      "@id": `${normalizedBase}#podcast`
    }
  };

  if (isValidDateString(film.podcastDate)) {
    schema.datePublished = film.podcastDate;
  }

  const imageUrl = toAbsoluteUrl(film.poster, normalizedBase);
  if (imageUrl) {
    schema.image = imageUrl;
  }

  if (film.linkType === "podcast" && isRealUrl(film.link) && !isPlatformPodcastLink(film.link)) {
    const media = {
      "@type": "MediaObject",
      contentUrl: film.link
    };
    if (film.link.toLowerCase().endsWith(".mp3")) {
      media.encodingFormat = "audio/mpeg";
    }
    schema.associatedMedia = media;
  }

  return schema;
}

export function injectJsonLd(id, jsonObjectOrArray) {
  if (!id || !jsonObjectOrArray) return;
  const head = document.head || document.querySelector("head");
  if (!head) return;
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    head.appendChild(script);
  }
  script.textContent = JSON.stringify(jsonObjectOrArray);
}
