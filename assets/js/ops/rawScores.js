(() => {
  const SUPABASE_URL = "https://johklrouorflqfmzpiaw.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvaGtscm91b3JmbHFmbXpwaWF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzgzNDQsImV4cCI6MjA4NTU1NDM0NH0.28kgIYh_BW-Ok2EHtxvm0NZM4e_0k2HzSFN0bkj9NPw";
  const MANIFEST_URL = "/assets/data/films/manifest.json";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const tableBody = document.getElementById("ops-table-body");
  const stateEl = document.getElementById("ops-state");
  const refreshedAtEl = document.getElementById("ops-refreshed-at");
  const refreshButton = document.getElementById("ops-refresh");
  const copyLinkButton = document.getElementById("ops-copy-link");
  const voterStateEl = document.getElementById("ops-voter-state");
  const voterTableBody = document.getElementById("ops-voter-table-body");
  const voterKpisEl = document.getElementById("ops-voter-kpis");

  const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function fmtAbsolute(ts) {
    if (!ts) return "—";
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  }

  function fmtRelative(ts) {
    if (!ts) return "—";
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return "—";
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const abs = Math.abs(seconds);
    if (abs < 60) return rtf.format(seconds, "second");
    if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
    return rtf.format(Math.round(seconds / 86400), "day");
  }

  function fmtDateOnly(value) {
    if (!value) return "Date unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unknown";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  async function loadMetadataFromSupabase() {
    if (!supabaseClient) return null;

    const candidates = [
      { table: "film_meta", columns: "film_id,title,podcastDate,podcast_date,rob,version_label" },
      { table: "film_scores_v1", columns: "film_id,title,podcastDate,podcast_date,rob,version_label" }
    ];

    for (const candidate of candidates) {
      const { data, error } = await supabaseClient.from(candidate.table).select(candidate.columns).limit(1000);
      if (error || !Array.isArray(data) || data.length === 0) continue;

      const byId = new Map();
      data.forEach((row) => {
        const filmId = row.film_id || row.id;
        if (!filmId) return;
        const versionLabel = row.version_label || (row.rob === true ? "Rob’s Version" : "");
        byId.set(filmId, {
          title: row.title || filmId,
          podcastDate: row.podcastDate || row.podcast_date || null,
          versionLabel
        });
      });

      if (byId.size > 0) return byId;
    }

    return null;
  }

  async function loadMetadataFromManifest() {
    const manifestRes = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!manifestRes.ok) throw new Error(`Manifest request failed (${manifestRes.status})`);
    const manifest = await manifestRes.json();
    const filmEntries = Array.isArray(manifest.films) ? manifest.films : [];

    const jsonEntries = filmEntries.filter((entry) => entry?.path).map((entry) => entry.path);
    const filePayloads = await Promise.all(
      jsonEntries.map(async (path) => {
        try {
          const res = await fetch(path, { cache: "no-store" });
          if (!res.ok) return null;
          return await res.json();
        } catch (_error) {
          return null;
        }
      })
    );

    const byId = new Map();
    filePayloads.forEach((film) => {
      if (!film?.id) return;
      byId.set(film.id, {
        title: film.title || film.id,
        podcastDate: film.podcastDate || film.podcasted_at || null,
        versionLabel: film.rob ? "Rob’s Version" : ""
      });
    });

    return byId;
  }

  function getRatingCount(ratingCounts, score) {
    if (!ratingCounts || typeof ratingCounts !== "object") return 0;
    const raw = ratingCounts[String(score)] ?? ratingCounts[score];
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  }

  function renderRows(rows, metadataById) {
    tableBody.innerHTML = "";

    rows.forEach((row, index) => {
      const meta = metadataById.get(row.film_id) || {};
      const title = meta.title || row.film_id;
      const versionLabel = meta.versionLabel || "";
      const detailsId = `ops-details-${index}`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <button class="ops-film-btn" type="button" aria-expanded="false" aria-controls="${detailsId}">
            <span class="ops-film-title">${title}</span>
            ${versionLabel ? `<span class="ops-version-tag">[${versionLabel}]</span>` : ""}
            <span class="ops-film-date">Podcasted: ${fmtDateOnly(meta.podcastDate)}</span>
          </button>
        </td>
        <td>${Number(row.votes_total || 0).toLocaleString()}</td>
        <td>${fmtRelative(row.last_vote_at)}</td>
        <td>${Number(row.votes_last_24h || 0).toLocaleString()}</td>
        <td>${Number(row.avg_rating || 0).toFixed(2)}</td>
      `;

      const detailsRow = document.createElement("tr");
      detailsRow.className = "ops-details-row";
      detailsRow.id = detailsId;
      detailsRow.hidden = true;
      detailsRow.innerHTML = `
        <td colspan="5">
          <div class="ops-details">
            <div class="ops-details-grid">
              <div><strong>Last vote:</strong> ${fmtAbsolute(row.last_vote_at)}</div>
              <div><strong>First vote:</strong> ${fmtAbsolute(row.first_vote_at)}</div>
              <div><strong>Votes last 7d:</strong> ${Number(row.votes_last_7d || 0).toLocaleString()}</div>
            </div>
            <div class="ops-rating-dist">
              ${Array.from({ length: 10 }, (_, i) => i + 1)
                .map((score) => `<span class="ops-rating-pill">${score}: ${getRatingCount(row.rating_counts, score)}</span>`)
                .join("")}
            </div>
          </div>
        </td>
      `;

      const toggleBtn = tr.querySelector(".ops-film-btn");
      toggleBtn?.addEventListener("click", () => {
        const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
        toggleBtn.setAttribute("aria-expanded", String(!expanded));
        detailsRow.hidden = expanded;
      });

      tableBody.appendChild(tr);
      tableBody.appendChild(detailsRow);
    });
  }


  async function fetchVoterDistribution() {
    if (!supabaseClient) {
      throw new Error("Supabase client is unavailable on this page.");
    }

    const { data, error } = await supabaseClient
      .from("ops_voter_film_count_distribution")
      .select("films_voted,voters")
      .order("films_voted", { ascending: true });

    if (error) {
      throw new Error(`Could not load voter distribution: ${error.message}`);
    }

    return Array.isArray(data) ? data : [];
  }

  function sumVoters(rows, predicate = () => true) {
    return rows.reduce((total, row) => {
      const filmsVoted = Number(row.films_voted || 0);
      const voters = Number(row.voters || 0);
      if (!Number.isFinite(voters) || !predicate(filmsVoted)) return total;
      return total + voters;
    }, 0);
  }

  function renderVoterKpis(rows) {
    const uniqueVoters = sumVoters(rows);
    const votersWith2Plus = sumVoters(rows, (filmsVoted) => filmsVoted >= 2);
    const votersWith3Plus = sumVoters(rows, (filmsVoted) => filmsVoted >= 3);

    voterKpisEl.innerHTML = `
      <div class="ops-kpi-card">
        <span class="ops-kpi-label">Unique voters</span>
        <span class="ops-kpi-value">${uniqueVoters.toLocaleString()}</span>
      </div>
      <div class="ops-kpi-card">
        <span class="ops-kpi-label">Voters with 2+ films</span>
        <span class="ops-kpi-value">${votersWith2Plus.toLocaleString()}</span>
      </div>
      <div class="ops-kpi-card">
        <span class="ops-kpi-label">Voters with 3+ films</span>
        <span class="ops-kpi-value">${votersWith3Plus.toLocaleString()}</span>
      </div>
    `;
    voterKpisEl.hidden = false;
  }

  function renderVoterDistribution(rows) {
    voterTableBody.innerHTML = "";

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${Number(row.films_voted || 0).toLocaleString()}</td>
        <td>${Number(row.voters || 0).toLocaleString()}</td>
      `;
      voterTableBody.appendChild(tr);
    });
  }

  async function renderVoterSection() {
    if (!voterStateEl || !voterTableBody || !voterKpisEl) return;

    voterStateEl.className = "ops-loading";
    voterStateEl.textContent = "Loading voter engagement…";
    voterKpisEl.hidden = true;
    voterKpisEl.innerHTML = "";
    voterTableBody.innerHTML = "";

    try {
      const rows = await fetchVoterDistribution();
      if (rows.length === 0) {
        voterStateEl.className = "ops-empty";
        voterStateEl.textContent = "No voter engagement data found.";
        return;
      }

      voterStateEl.className = "";
      voterStateEl.textContent = "";
      renderVoterKpis(rows);
      renderVoterDistribution(rows);
    } catch (error) {
      voterStateEl.className = "ops-error";
      voterStateEl.textContent = error instanceof Error ? error.message : "Unable to load voter engagement data.";
    }
  }

  async function loadOpsData() {
    if (!supabaseClient) {
      throw new Error("Supabase client is unavailable on this page.");
    }

    const [{ data: aggregateRows, error: aggregateError }, metadataById] = await Promise.all([
      supabaseClient
        .from("ops_film_vote_summary")
        .select("film_id,votes_total,last_vote_at,first_vote_at,votes_last_24h,votes_last_7d,avg_rating,rating_counts")
        .order("last_vote_at", { ascending: false }),
      (async () => {
        return (await loadMetadataFromSupabase()) || (await loadMetadataFromManifest());
      })()
    ]);

    if (aggregateError) {
      throw new Error(`Could not load vote summary: ${aggregateError.message}`);
    }

    return {
      rows: Array.isArray(aggregateRows) ? aggregateRows : [],
      metadataById: metadataById || new Map()
    };
  }

  async function render() {
    stateEl.className = "ops-loading";
    stateEl.textContent = "Loading vote health metrics…";

    try {
      const { rows, metadataById } = await loadOpsData();
      if (rows.length === 0) {
        tableBody.innerHTML = "";
        stateEl.className = "ops-empty";
        stateEl.textContent = "No aggregated vote data found.";
      } else {
        stateEl.className = "";
        stateEl.textContent = "";
        renderRows(rows, metadataById);
      }

      refreshedAtEl.textContent = new Date().toLocaleString();
      await renderVoterSection();
    } catch (error) {
      tableBody.innerHTML = "";
      stateEl.className = "ops-error";
      stateEl.textContent = error instanceof Error ? error.message : "Unable to load ops data.";
      await renderVoterSection();
    }
  }

  refreshButton?.addEventListener("click", () => {
    render();
  });

  copyLinkButton?.addEventListener("click", async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      copyLinkButton.textContent = "Copied";
      window.setTimeout(() => {
        copyLinkButton.textContent = "Copy link";
      }, 1400);
    } catch (_error) {
      copyLinkButton.textContent = "Copy failed";
      window.setTimeout(() => {
        copyLinkButton.textContent = "Copy link";
      }, 1400);
    }
  });

  render();
})();
