(() => {
  const SUPABASE_URL = "https://johklrouorflqfmzpiaw.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvaGtscm91b3JmbHFmbXpwaWF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzgzNDQsImV4cCI6MjA4NTU1NDM0NH0.28kgIYh_BW-Ok2EHtxvm0NZM4e_0k2HzSFN0bkj9NPw";
  const MANIFEST_URL = "/assets/data/films/manifest.json";

  const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const tableBody = document.getElementById("ops-table-body");
  const stateEl = document.getElementById("ops-state");
  const refreshedAtEl = document.getElementById("ops-refreshed-at");
  const refreshButton = document.getElementById("ops-refresh");
  const copyLinkButton = document.getElementById("ops-copy-link");
  const voterStateEl = document.getElementById("ops-voter-state");
  const voterTableBody = document.getElementById("ops-voter-table-body");
  const voterKpisEl = document.getElementById("ops-voter-kpis");

  let votesTrendChart30Instance = null;

  function fmtRelative(timestamp) {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "—";
    return formatRelativeTime(date.getTime() - Date.now());
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

  function formatRelativeTime(ms) {
    const seconds = Math.round(ms / 1000);
    const abs = Math.abs(seconds);
    if (abs < 60) return rtf.format(seconds, "second");
    if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
    return rtf.format(Math.round(seconds / 86400), "day");
  }

  async function loadMetadataFromManifest() {
    const manifestRes = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!manifestRes.ok) return new Map();
    const manifest = await manifestRes.json();
    const filmEntries = Array.isArray(manifest.films) ? manifest.films : [];

    const paths = filmEntries.filter((entry) => entry?.path).map((entry) => entry.path);
    const films = await Promise.all(paths.map(async (path) => {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) return null;
        return await res.json();
      } catch (_error) {
        return null;
      }
    }));

    const byId = new Map();
    films.forEach((film) => {
      if (!film?.id) return;
      byId.set(film.id, {
        title: film.title || film.id,
        podcastDate: film.podcastDate || film.podcasted_at || null,
        versionLabel: film.rob ? "Rob’s Version" : ""
      });
    });
    return byId;
  }

  async function loadOpsTotals() {
    const grid = document.getElementById("opsKpiGrid");
    const meta = document.getElementById("opsKpiMeta");
    if (!grid || !meta || !supabase) return;

    grid.innerHTML = "Loading totals…";
    meta.textContent = "";

    const { data, error } = await supabase
      .from("ops_vote_totals")
      .select("*")
      .limit(1)
      .single();

    if (error) {
      console.error("Could not load ops totals:", error);
      grid.innerHTML = "Could not load totals.";
      return;
    }

    const lastVote = data.last_vote_at ? new Date(data.last_vote_at) : null;
    const now = new Date();
    const lastVoteRel = lastVote ? formatRelativeTime(lastVote - now) : "—";

    const kpis = [
      { label: "Total votes", value: data.total_votes },
      { label: "Votes today", value: data.votes_today },
      { label: "Votes (24h)", value: data.votes_24h },
      { label: "Votes (7d)", value: data.votes_7d },
      { label: "Unique voters", value: data.unique_voters },
      { label: "Votes / voter", value: data.votes_per_voter }
    ];

    grid.innerHTML = kpis.map((k) => `
      <div class="ops-kpi-item">
        <div class="ops-kpi-label">${k.label}</div>
        <div class="ops-kpi-value">${k.value ?? "—"}</div>
      </div>
    `).join("");

    meta.textContent = `Last vote: ${lastVoteRel}`;
  }

  async function loadVotesTrend30() {
    const canvas = document.getElementById("votesTrendChart30");
    if (!canvas || !supabase || typeof window.Chart === "undefined") return;

    const { data, error } = await supabase
      .from("ops_votes_by_day_30")
      .select("day,votes,unique_voters,avg_rating")
      .order("day", { ascending: true });

    if (error) {
      console.error("Daily trend load error:", error);
      return;
    }

    const labels = data.map((r) => r.day);
    const votes = data.map((r) => r.votes);
    const ctx = canvas.getContext("2d");

    if (votesTrendChart30Instance) votesTrendChart30Instance.destroy();

    votesTrendChart30Instance = new window.Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Votes per day",
          data: votes,
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "#222" }, ticks: { color: "#aaa" } },
          y: { beginAtZero: true, grid: { color: "#222" }, ticks: { color: "#aaa" } }
        }
      }
    });
  }

  async function loadFilmSummary() {
    if (!stateEl || !tableBody || !supabase) return;
    stateEl.className = "ops-loading";
    stateEl.textContent = "Loading vote health metrics…";
    tableBody.innerHTML = "";

    const [
      { data: rows, error },
      metadata
    ] = await Promise.all([
      supabase
        .from("ops_film_vote_summary")
        .select("film_id,votes_total,last_vote_at,votes_last_24h,avg_rating")
        .order("last_vote_at", { ascending: false }),
      loadMetadataFromManifest()
    ]);

    if (error) {
      stateEl.className = "ops-error";
      stateEl.textContent = `Could not load vote summary: ${error.message}`;
      return;
    }

    if (!rows?.length) {
      stateEl.className = "ops-empty";
      stateEl.textContent = "No aggregated vote data found.";
      return;
    }

    stateEl.className = "";
    stateEl.textContent = "";

    rows.forEach((row) => {
      const meta = metadata.get(row.film_id) || {};
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <span class="ops-film-title">${meta.title || row.film_id}</span>
          <span class="ops-film-date">Podcasted: ${fmtDateOnly(meta.podcastDate)}</span>
        </td>
        <td>${Number(row.votes_total || 0).toLocaleString()}</td>
        <td>${fmtRelative(row.last_vote_at)}</td>
        <td>${Number(row.votes_last_24h || 0).toLocaleString()}</td>
        <td>${Number(row.avg_rating || 0).toFixed(2)}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  async function loadVoterDistribution() {
    if (!voterStateEl || !voterTableBody || !voterKpisEl || !supabase) return;
    voterStateEl.className = "ops-loading";
    voterStateEl.textContent = "Loading voter engagement…";
    voterKpisEl.hidden = true;
    voterTableBody.innerHTML = "";

    const { data, error } = await supabase
      .from("ops_voter_film_count_distribution")
      .select("films_voted,voters")
      .order("films_voted", { ascending: true });

    if (error) {
      voterStateEl.className = "ops-error";
      voterStateEl.textContent = `Could not load voter engagement: ${error.message}`;
      return;
    }

    if (!data?.length) {
      voterStateEl.className = "ops-empty";
      voterStateEl.textContent = "No voter engagement data found.";
      return;
    }

    const totalVoters = data.reduce((sum, row) => sum + (Number(row.voters) || 0), 0);
    const votersWith3Plus = data
      .filter((row) => Number(row.films_voted) >= 3)
      .reduce((sum, row) => sum + (Number(row.voters) || 0), 0);

    voterKpisEl.innerHTML = `
      <div class="ops-kpi-card">
        <span class="ops-kpi-label">Total voters</span>
        <span class="ops-kpi-value">${totalVoters.toLocaleString()}</span>
      </div>
      <div class="ops-kpi-card">
        <span class="ops-kpi-label">Voters with 3+ films</span>
        <span class="ops-kpi-value">${votersWith3Plus.toLocaleString()}</span>
      </div>
    `;
    voterKpisEl.hidden = false;

    voterStateEl.className = "";
    voterStateEl.textContent = "";
    data.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${Number(row.films_voted || 0).toLocaleString()}</td>
        <td>${Number(row.voters || 0).toLocaleString()}</td>
      `;
      voterTableBody.appendChild(tr);
    });
  }

  async function refreshAll() {
    if (!supabase) {
      stateEl.textContent = "Supabase client is unavailable on this page.";
      stateEl.className = "ops-error";
      return;
    }

    await loadOpsTotals();
    await loadVotesTrend30();
    await loadFilmSummary();
    await loadVoterDistribution();
    if (refreshedAtEl) refreshedAtEl.textContent = new Date().toLocaleString();
  }

  refreshButton?.addEventListener("click", () => {
    refreshAll();
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

  refreshAll();
})();
