/*
  Generate sitemap.xml from assets/data/films/manifest.json.
  Run: node scripts/generate-sitemap.js
*/

const fs = require("fs");
const path = require("path");

const BASE_URL = "https://nocontextcinemaclub.com";
const MANIFEST_PATH = path.join(__dirname, "..", "assets", "data", "films", "manifest.json");
const OUTPUT_PATH = path.join(__dirname, "..", "sitemap.xml");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isValidDateString(value) {
  if (!value || typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function buildUrlEntry(loc, lastmod) {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
}

function generateSitemap() {
  const manifest = readJson(MANIFEST_PATH);
  const today = todayStamp();
  const urls = [
    { loc: `${BASE_URL}/`, lastmod: today },
    { loc: `${BASE_URL}/pages/about.html`, lastmod: today },
    { loc: `${BASE_URL}/pages/listen.html`, lastmod: today },
    { loc: `${BASE_URL}/pages/contact.html`, lastmod: today }
  ];

  (manifest.films || [])
    .filter((entry) => entry.active)
    .forEach((entry) => {
      const normalizedEntryPath = entry.path.replace(/^\.\//, "").replace(/^\//, "");
      const filmPath = path.join(__dirname, "..", normalizedEntryPath);
      try {
        const film = readJson(filmPath);
        if (!film || !film.id) return;
        urls.push({
          loc: `${BASE_URL}#${film.id}`,
          lastmod: isValidDateString(film.podcastDate) ? film.podcastDate : today
        });
      } catch (error) {
        console.warn(`Skipping ${entry.path}: ${error.message}`);
      }
    });

  const body = urls.map((entry) => buildUrlEntry(entry.loc, entry.lastmod)).join("\n");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.writeFileSync(OUTPUT_PATH, sitemap, "utf8");
  console.log(`Sitemap written to ${OUTPUT_PATH}`);
}

generateSitemap();
