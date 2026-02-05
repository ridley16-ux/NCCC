# How to upload/add a new film (JSON + posters + thumbnails)

## 1) Overview (what you edit and what you add)

When you add a new episode/film pair, you normally touch **four places**:

1. **Rob film JSON**: `assets/data/films/robs/<slug>.json`
2. **Real film JSON**: `assets/data/films/real/<slug>.json`
3. **Manifest index**: `assets/data/films/manifest.json` (add both JSON paths)
4. **Poster asset(s)**:
   - Rob posters are local files in: `assets/img/posters/robs/`
   - Real film posters are currently mostly remote URLs (Flixster/RT links in JSON), not local files

How the page works today:

- The films page loads data from `assets/data/films/manifest.json`, then fetches each listed JSON file from its `path` value. If a film is not in `manifest.json`, it will not load.
- “Rob’s films” vs “Real films” are split by the JSON field `rob`:
  - `"rob": true` = Rob’s version
  - `"rob": false` = Real film
- Search only checks **title** and **starring**.
- Sorting is calculated in code:
  - Rating sort = composite score from Kev score + RT score (with fallbacks)
  - Listener sort = Supabase audience score (only available when filtering Rob films)

---

## 2) Step-by-step: Add a new film

### Step 1: Create a slug (and keep it consistent)

Use one lowercase kebab-case slug for the episode title, e.g.:

- `face-off`
- `good-will-hunting`
- `minority-report`

#### Slug rules

- Lowercase only
- Use hyphens, not spaces/underscores
- Keep punctuation out (`/`, `?`, `:`, etc.)
- Use the **same slug** in filenames and IDs

#### ID convention used in JSON

- Rob film ID: `rob-<slug>`
- Real film ID: `real-<slug>`

Examples:

- `rob-face-off`
- `real-face-off`

---

### Step 2: Add poster image(s)

### Rob posters (required local asset)

Save the file in:

- `assets/img/posters/robs/`

Filename format:

- `<slug>-rob.webp`

Example:

- `assets/img/posters/robs/face-off-rob.webp`

JSON path value should be absolute-from-site-root:

```json
"poster": "/assets/img/posters/robs/face-off-rob.webp"
```

### Real film posters (current repo behaviour)

Right now, real-film JSON files use external poster URLs. There is **no existing local `assets/img/posters/real/` folder** in the repo.

So you currently have two options:

1. **Match current pattern** (recommended for consistency now): keep using a reliable external poster URL in the real-film JSON.
2. **Introduce a new standard** (if you want local hosting): create `assets/img/posters/real/` and store local files as `<slug>-real.webp`, then use `"/assets/img/posters/real/<slug>-real.webp"` in JSON.

If you introduce option 2, apply it consistently going forward.

### Required format and sizing guidance

- Format: `.webp` for local images
- Orientation: poster portrait (existing cards are styled like poster art)
- Recommended size: around **600 × 900** (or similar 2:3 ratio)
- Compression target: aim for roughly **100–300 KB** each without obvious visual artefacts

---

### Step 3: Add thumbnails/tiles/OG images (if used)

For film entries, there are currently **no separate film thumbnail/tile/OG image fields** in the film JSON schema.

- Card image uses the `poster` field
- Podcast episode schema (`assets/js/seo.js`) also uses `film.poster`
- Site-wide OG/Twitter image tags on pages point to `assets/branding/podcast-cover.webp`

So for new films, you normally do **nothing extra** for thumbnails/OG.

---

### Step 4: Create/update the film JSON files

Create two JSON files using the same slug:

- `assets/data/films/robs/<slug>.json`
- `assets/data/films/real/<slug>.json`

## Rob film JSON schema

### Required fields (practical minimum)

- `id` (string, must be unique, e.g. `rob-<slug>`)
- `rob` (`true`)
- `title` (string)
- `starring` (string)
- `poster` (string path/URL)
- `coherence` (number 1–10)
- `entertainment` (number 1–10)
- `originality` (number 1–10)
- `podcastDate` (`YYYY-MM-DD`)
- `summary` (string)
- `link` (string)

### Optional fields

- `linkType` (commonly `"podcast"`)
- `transcriptTxt` (path to transcript text file)
- `rosettes` (array of custom badges)
- `kevScore` (normally auto-derived from the 3 sub-scores, so usually omit)

## Real film JSON schema

### Required fields (practical minimum)

- `id` (string, must be unique, e.g. `real-<slug>`)
- `rob` (`false`)
- `title` (string)
- `starring` (string)
- `poster` (string path/URL)
- `score` (number, Rotten Tomatoes %)
- `podcastDate` (`YYYY-MM-DD`)
- `summary` (string)
- `link` (string, usually RT URL)

### Optional fields

- `director` (string)
- `scoreLabel` (usually `"🍅 Rotten Tomatoes"`)
- `linkType` (commonly `"rt"`)
- `transcriptTxt` (if you want transcript button shown)
- `rosettes` (custom badges)

## Example entries (copy and edit)

### `assets/data/films/robs/the-matrix.json`

```json
{
  "id": "rob-the-matrix",
  "rob": true,
  "title": "The Matrix",
  "starring": "Keanu Reeves",
  "poster": "/assets/img/posters/robs/the-matrix-rob.webp",
  "coherence": 8,
  "entertainment": 9,
  "originality": 7,
  "podcastDate": "2026-03-05",
  "summary": "A burned-out office worker discovers reality is a corporate simulation and attempts to unionise the resistance.",
  "link": "#",
  "linkType": "podcast",
  "transcriptTxt": "/assets/data/transcripts/the-matrix.txt"
}
```

### `assets/data/films/real/the-matrix.json`

```json
{
  "id": "real-the-matrix",
  "rob": false,
  "title": "The Matrix",
  "director": "The Wachowskis",
  "starring": "Keanu Reeves, Laurence Fishburne",
  "poster": "https://example.com/path/to/matrix-poster.jpg",
  "score": 83,
  "scoreLabel": "🍅 Rotten Tomatoes",
  "podcastDate": "2026-03-05",
  "summary": "A computer hacker learns the world he knows is a simulation and joins a rebellion against its controllers.",
  "link": "https://www.rottentomatoes.com/m/matrix",
  "linkType": "rt"
}
```

### Where to place entries / sorting behaviour

- These files are **individual JSON files** (not a single array file), so there is no in-file array position to manage.
- Display order is controlled by UI sort mode, not file location:
  - Default sort is rating-desc on the films page.
  - Stable tie-break uses original manifest order.

---

### Step 5: Update `manifest.json` (required)

Add both new film JSON paths into `assets/data/films/manifest.json` under `films`:

```json
{
  "path": "/assets/data/films/robs/the-matrix.json",
  "active": true
},
{
  "path": "/assets/data/films/real/the-matrix.json",
  "active": true
}
```

Notes:

- `active: true` is required for loading.
- Even with `active: true`, a future `podcastDate` won’t show yet because the loader checks date gating.

---

### Step 6: Supporting indexes (when required)

## `assets/data/films/votes.json`

- This file exists but the films page currently reads listener scores from Supabase tables (`film_listener_scores` / `film_votes`), not from this file.
- **Do not rely on editing `votes.json`** to make listener ratings work on live data.
- Usually, leave `votes.json` alone unless you are intentionally changing legacy/offline fallback logic.

## Transcript files (optional)

If you set `transcriptTxt`, create the matching file under:

- `assets/data/transcripts/<slug>.txt`

If the file path is wrong, the transcript modal will fail to load.

---

## 3) Validation / QA checklist

After adding films, run through this checklist:

### Data integrity

- `manifest.json` is valid JSON (no trailing commas)
- Both new JSON files are valid JSON
- `id` values are unique and match slug pattern (`rob-...` and `real-...`)
- `rob` boolean is correct in each file
- `poster` paths/URLs resolve

### Films page checks

Open `index.html` (or local site root) and verify:

- New Rob film appears in **Rob filter**
- New Real film appears in **Real filter**
- Search finds film by title and starring text
- Default sorting and sort dropdown still work
- Listener sort options only appear when not in Real-only filter
- Rosettes still appear correctly (`Rob’s Film` / `Real Film`, plus computed picks)

### Score checks

- Rob card shows Kev score calculated from coherence + entertainment + originality
- Real card shows RT score from `score`
- Listener score/votes render as available from Supabase (do not hard-code these in JSON for normal operation)

### Common mistakes + fixes

- **Broken poster image**
  - Fix: confirm exact `poster` path and filename case; ensure file exists in `assets/img/posters/robs/` for Rob posters.
- **Film does not appear at all**
  - Fix: ensure both JSON files are referenced in `assets/data/films/manifest.json` and `active` is true.
- **Film hidden unexpectedly**
  - Fix: check `podcastDate`; future dates are date-gated and not considered live.
- **Wrong section (Rob vs Real)**
  - Fix: check `rob` boolean value.
- **Search does not find film**
  - Fix: make sure `title` or `starring` contains the search text.
- **JSON parse errors**
  - Fix: validate commas/quotes/braces; avoid trailing commas.

---

## 4) Fast path (60-second checklist)

1. Pick slug: `the-matrix` (lowercase kebab-case).
2. Add Rob poster: `assets/img/posters/robs/the-matrix-rob.webp`.
3. Create:
   - `assets/data/films/robs/the-matrix.json`
   - `assets/data/films/real/the-matrix.json`
4. Set IDs:
   - `rob-the-matrix`
   - `real-the-matrix`
5. Add both file paths to `assets/data/films/manifest.json` with `"active": true`.
6. Confirm `rob: true` vs `rob: false` is correct.
7. Open films page and test:
   - Rob/Real filters
   - Search (title/starring)
   - Sorting (rating + listener)
   - Poster loads
8. Do **not** manually hack listener score/vote live data in JSON; Supabase controls that.
