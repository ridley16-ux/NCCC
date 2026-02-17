const MANIFEST_URL = "/assets/data/films/manifest.json";
const VOTES_URL = "/assets/data/films/votes.json";
const PASS_HASH = "125a4886a3cc2abaecc0869264f1928322de24c152bde53ee1b2e283447c3041";
const STORAGE_FLAG = "nccc_ops_ok";

const SUPABASE_URL = "https://johklrouorflqfmzpiaw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvaGtscm91b3JmbHFmbXpwaWF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzgzNDQsImV4cCI6MjA4NTU1NDM0NH0.28kgIYh_BW-Ok2EHtxvm0NZM4e_0k2HzSFN0bkj9NPw";

const state = { rows: [], filtered: [] };

const els = {
  gate: document.getElementById("qaGate"),
  app: document.getElementById("qaApp"),
  passphraseInput: document.getElementById("passphraseInput"),
  passphraseSubmit: document.getElementById("passphraseSubmit"),
  gateMessage: document.getElementById("gateMessage"),
  status: document.getElementById("statusLine"),
  tableBody: document.getElementById("qaTableBody"),
  searchInput: document.getElementById("searchInput"),
  typeFilter: document.getElementById("typeFilter"),
  healthFilter: document.getElementById("healthFilter"),
  last20Toggle: document.getElementById("last20Toggle"),
  copyTsvBtn: document.getElementById("copyTsvBtn"),
  downloadJsonBtn: document.getElementById("downloadJsonBtn")
};

function parseSortDate(film) {
  const sources = [
    ["created_at", film.created_at],
    ["publish_date", film.publish_date],
    ["episode_date", film.episode_date],
    ["updated_at", film.updated_at],
    ["release_year", film.release_year ? `${film.release_year}-01-01` : null]
  ];

  for (const [source, value] of sources) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return { date, source };
  }
  return { date: new Date("1970-01-01T00:00:00Z"), source: "fallback" };
}

function detectType(path, film) {
  if (typeof film.rob === "boolean") return film.rob ? "rob" : "real";
  if (path.includes("/robs/")) return "rob";
  if (path.includes("/real/")) return "real";
  return "real";
}

function getKevScore(film) {
  if (Number.isFinite(Number(film.score))) return Number(film.score);
  const parts = [film.coherence, film.entertainment, film.originality].map(Number).filter(Number.isFinite);
  if (!parts.length) return null;
  return Number((parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(2));
}

function normalizeFilm(film, path) {
  const { date, source } = parseSortDate(film);
  const type = detectType(path, film);
  const id = film.id || film.slug || "";
  const kevScore = getKevScore(film);
  const poster = film.poster || film.poster_url || null;
  const episode = film.episode || film.week || film.episode_number || null;

  const missing = [];
  if (!film.title) missing.push("title");
  if (!id) missing.push("id/slug");
  if (!poster) missing.push("poster");

  return {
    type,
    title: film.title || "Untitled",
    slug_or_id: id,
    sort_date: date.toISOString(),
    sort_date_source: source,
    episode,
    kev_score: kevScore,
    listener_score: null,
    vote_count: null,
    last_vote_at: null,
    poster_url: poster,
    public_url: id ? `/#${id}` : "/",
    leaderboard_url: id ? `/#${id}` : "/",
    json_url: path,
    health: {
      missing_fields: missing,
      warnings: []
    }
  };
}

function applySupabase(rows, supaRows) {
  const byId = new Map((supaRows || []).map((row) => [row.film_id, row]));
  rows.forEach((row) => {
    const agg = byId.get(row.slug_or_id);
    if (!agg) return;
    row.listener_score = Number.isFinite(Number(agg.avg_rating)) ? Number(agg.avg_rating) : row.listener_score;
    row.vote_count = Number.isFinite(Number(agg.votes_total)) ? Number(agg.votes_total) : row.vote_count;
    row.last_vote_at = agg.last_vote_at || row.last_vote_at;
  });
}

function applyVotesJson(rows, votesJson) {
  const totals = votesJson?.totals || {};
  rows.forEach((row) => {
    if (row.vote_count == null && Object.prototype.hasOwnProperty.call(totals, row.slug_or_id)) {
      row.vote_count = Number(totals[row.slug_or_id]) || 0;
    }
  });
}

function finalizeHealth(row) {
  if (row.kev_score != null && (!Number.isFinite(row.kev_score) || row.kev_score < 0 || row.kev_score > 100)) {
    row.health.warnings.push("Kev score out of range");
  }
  if (row.listener_score != null && (!Number.isFinite(row.listener_score) || row.listener_score < 0 || row.listener_score > 10)) {
    row.health.warnings.push("Listener score out of range");
  }
  if (row.vote_count != null && (!Number.isFinite(row.vote_count) || row.vote_count < 0)) {
    row.health.warnings.push("Vote count invalid");
  }
}

function sortRows(rows) {
  rows.sort((a, b) => {
    const da = new Date(a.sort_date).getTime();
    const db = new Date(b.sort_date).getTime();
    if (db !== da) return db - da;
    return a.title.localeCompare(b.title);
  });
}

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function rowClass(row) {
  if (row.health.missing_fields.length) return "qa-row-error";
  if (row.health.warnings.length) return "qa-row-warning";
  return "";
}

function healthHtml(row) {
  const chunks = [];
  if (!row.health.missing_fields.length && !row.health.warnings.length) {
    return '<span class="health-ok">✓ OK</span>';
  }
  row.health.missing_fields.forEach((field) => chunks.push(`<div class="health-bad">Missing: ${field}</div>`));
  row.health.warnings.forEach((w) => chunks.push(`<div class="health-warn">Warn: ${w}</div>`));
  return chunks.join("");
}

function renderRows(rows) {
  els.tableBody.innerHTML = "";
  const frag = document.createDocumentFragment();
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = rowClass(row);
    tr.innerHTML = `
      <td><span class="badge badge-${row.type}">${row.type.toUpperCase()}</span></td>
      <td>${row.title}</td>
      <td>${row.slug_or_id || "—"}</td>
      <td>${fmtDate(row.sort_date)} <span class="qa-muted">(${row.sort_date_source})</span></td>
      <td>${row.episode || "—"}</td>
      <td>${row.kev_score ?? "—"}</td>
      <td>${row.listener_score ?? "—"}</td>
      <td>${row.vote_count ?? "—"}</td>
      <td>${fmtDate(row.last_vote_at)}</td>
      <td class="qa-links">
        <a href="${row.public_url}" target="_blank" rel="noopener">Film</a>
        <a href="${row.leaderboard_url}" target="_blank" rel="noopener">Leaderboard</a>
        <a href="${row.json_url}" target="_blank" rel="noopener">JSON</a>
      </td>
      <td>${healthHtml(row)}</td>
    `;
    frag.appendChild(tr);
  });
  els.tableBody.appendChild(frag);
  els.status.textContent = `Showing ${rows.length} films`;
}

function currentFilteredRows() {
  const q = els.searchInput.value.trim().toLowerCase();
  const type = els.typeFilter.value;
  const health = els.healthFilter.value;
  const limit = els.last20Toggle.checked;

  let rows = state.rows.filter((row) => {
    if (q && !(row.title.toLowerCase().includes(q) || row.slug_or_id.toLowerCase().includes(q))) return false;
    if (type !== "all" && row.type !== type) return false;
    if (health === "missing" && !row.health.missing_fields.length && !row.health.warnings.length) return false;
    if (health === "no-votes" && Number(row.vote_count || 0) > 0) return false;
    if (health === "has-votes" && Number(row.vote_count || 0) <= 0) return false;
    return true;
  });

  if (limit) rows = rows.slice(0, 20);
  state.filtered = rows;
  return rows;
}

function rerender() {
  renderRows(currentFilteredRows());
}

function toTsv(rows) {
  const headers = ["type", "title", "slug_or_id", "sort_date", "sort_date_source", "episode", "kev_score", "listener_score", "vote_count", "last_vote_at", "public_url", "json_url", "missing_fields", "warnings"];
  const lines = [headers.join("\t")];
  rows.forEach((row) => {
    lines.push([
      row.type,
      row.title,
      row.slug_or_id,
      row.sort_date,
      row.sort_date_source,
      row.episode || "",
      row.kev_score ?? "",
      row.listener_score ?? "",
      row.vote_count ?? "",
      row.last_vote_at || "",
      row.public_url,
      row.json_url,
      row.health.missing_fields.join(", "),
      row.health.warnings.join(", ")
    ].join("\t"));
  });
  return lines.join("\n");
}

async function loadData() {
  const manifestRes = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!manifestRes.ok) throw new Error("Failed to load film manifest");
  const manifest = await manifestRes.json();
  const entries = Array.isArray(manifest.films) ? manifest.films : [];

  const rows = [];
  await Promise.all(entries.map(async (entry) => {
    if (!entry?.path) return;
    try {
      const filmRes = await fetch(entry.path, { cache: "no-store" });
      if (!filmRes.ok) return;
      const film = await filmRes.json();
      rows.push(normalizeFilm(film, entry.path));
    } catch (_err) {
      // ignore missing film file
    }
  }));

  try {
    const votesRes = await fetch(VOTES_URL, { cache: "no-store" });
    if (votesRes.ok) {
      applyVotesJson(rows, await votesRes.json());
    }
  } catch (_err) {
    // continue without votes.json
  }

  try {
    if (window.supabase?.createClient) {
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data } = await client
        .from("ops_film_vote_summary")
        .select("film_id,votes_total,last_vote_at,avg_rating")
        .order("last_vote_at", { ascending: false });
      applySupabase(rows, data || []);
    }
  } catch (_err) {
    // continue with JSON-only dataset
  }

  rows.forEach(finalizeHealth);
  sortRows(rows);
  return rows;
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unlock() {
  els.gate.hidden = true;
  els.app.hidden = false;
}

async function attemptUnlock() {
  const value = els.passphraseInput.value || "";
  const digest = await sha256(value);
  if (digest === PASS_HASH) {
    localStorage.setItem(STORAGE_FLAG, "1");
    unlock();
    initApp();
    return;
  }
  els.gateMessage.textContent = "Unable to unlock.";
}

function attachEvents() {
  [els.searchInput, els.typeFilter, els.healthFilter, els.last20Toggle].forEach((el) => el?.addEventListener("input", rerender));
  els.copyTsvBtn?.addEventListener("click", async () => {
    const text = toTsv(state.filtered);
    await navigator.clipboard.writeText(text);
    els.status.textContent = `Copied ${state.filtered.length} rows as TSV`;
  });
  els.downloadJsonBtn?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nccc-qa-films-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

async function initApp() {
  try {
    els.status.textContent = "Loading films…";
    state.rows = await loadData();
    attachEvents();
    rerender();
  } catch (error) {
    els.status.textContent = `Could not load dataset: ${error.message}`;
  }
}

function initGate() {
  if (localStorage.getItem(STORAGE_FLAG) === "1") {
    unlock();
    initApp();
    return;
  }
  els.passphraseSubmit?.addEventListener("click", attemptUnlock);
  els.passphraseInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") attemptUnlock();
  });
}

initGate();
