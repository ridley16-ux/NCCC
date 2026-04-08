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

  const trendStateEl = document.getElementById("ops-trend-state");
  const trendTableBody = document.getElementById("ops-trend-table-body");
  const fromInput = document.getElementById("ops-date-from");
  const toInput = document.getElementById("ops-date-to");
  const aggregationSelect = document.getElementById("ops-aggregation");
  const rangeSnapshotEl = document.getElementById("opsRangeSnapshot");
  const weeklySnapshotEl = document.getElementById("opsWeeklySnapshot");

  const DAY_MS = 24 * 60 * 60 * 1000;
  const state = {
    trendDailyRows: [],
    releasesByDay: new Map()
  };

  let votesTrendChart30Instance = null;

  function utcDateKey(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateKey(dateKey) {
    const [year, month, day] = String(dateKey).split("-").map(Number);
    return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  }

  function addDays(date, days) {
    return new Date(date.getTime() + (days * DAY_MS));
  }

  function saturdayStart(date) {
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dow = utc.getUTCDay();
    const daysFromSaturday = (dow + 1) % 7;
    return addDays(utc, -daysFromSaturday);
  }

  function monthStart(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

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

  function formatPeriodDate(date) {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  function formatMonth(date) {
    return date.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  function metricCell(value, digits = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    return numeric.toFixed(digits);
  }

  function safePct(part, whole) {
    if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return null;
    return (part / whole) * 100;
  }

  function releaseLabel(titles = []) {
    if (!titles.length) return "—";
    return titles.map((title) => `Release: ${title}`).join(" • ");
  }

  function aggregateRows(rows, aggregation, releasesByDay) {
    const buckets = new Map();

    rows.forEach((row) => {
      const day = parseDateKey(row.day);
      let bucketKey;
      let startDate;
      let endDate;

      if (aggregation === "weekly") {
        startDate = saturdayStart(day);
        endDate = addDays(startDate, 6);
        bucketKey = utcDateKey(startDate);
      } else if (aggregation === "monthly") {
        startDate = monthStart(day);
        endDate = addDays(new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1)), -1);
        bucketKey = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, "0")}`;
      } else {
        startDate = day;
        endDate = day;
        bucketKey = row.day;
      }

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, {
          key: bucketKey,
          startDate,
          endDate,
          votes: 0,
          rawScoreTotal: 0,
          releases: new Set()
        });
      }

      const bucket = buckets.get(bucketKey);
      const votes = Number(row.votes) || 0;
      const rawScore = Number(row.raw_score_total) || 0;

      bucket.votes += votes;
      bucket.rawScoreTotal += rawScore;

      const dayReleases = releasesByDay.get(row.day) || [];
      dayReleases.forEach((title) => bucket.releases.add(title));
    });

    return Array.from(buckets.values())
      .sort((a, b) => a.startDate - b.startDate)
      .map((bucket) => {
        const avgScore = bucket.votes > 0 ? bucket.rawScoreTotal / bucket.votes : null;
        const avgPercent = avgScore == null ? null : avgScore * 10;
        let periodLabel = bucket.startDate.toISOString().slice(0, 10);

        if (aggregation === "weekly") {
          periodLabel = `${formatPeriodDate(bucket.startDate)} – ${formatPeriodDate(bucket.endDate)}`;
        } else if (aggregation === "monthly") {
          periodLabel = formatMonth(bucket.startDate);
        } else {
          periodLabel = bucket.startDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC"
          });
        }

        return {
          ...bucket,
          periodLabel,
          avgScore,
          avgPercent,
          releaseText: releaseLabel(Array.from(bucket.releases))
        };
      });
  }

  function fillTrendTable(rows) {
    if (!trendTableBody) return;
    trendTableBody.innerHTML = "";

    if (!rows.length) {
      trendStateEl.className = "ops-empty";
      trendStateEl.textContent = "No votes found in the selected range.";
      return;
    }

    trendStateEl.className = "";
    trendStateEl.textContent = "";

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.periodLabel}</td>
        <td>${row.votes.toLocaleString()}</td>
        <td>${row.rawScoreTotal.toLocaleString()}</td>
        <td>${metricCell(row.avgScore)}</td>
        <td>${row.avgPercent == null ? "—" : `${metricCell(row.avgPercent)}%`}</td>
        <td>${row.releaseText}</td>
      `;
      trendTableBody.appendChild(tr);
    });
  }

  function formatDiff(current, base, digits = 2) {
    if (!Number.isFinite(current) || !Number.isFinite(base)) return { text: "—", className: "ops-change-flat" };
    const diff = current - base;
    const pct = safePct(diff, base);
    const prefix = diff > 0 ? "+" : "";
    const diffText = `${prefix}${diff.toFixed(digits)}`;
    const pctText = pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
    const className = diff > 0 ? "ops-change-up" : diff < 0 ? "ops-change-down" : "ops-change-flat";
    return { text: `${diffText} (${pctText})`, className };
  }

  function setRangeSnapshot(aggregatedRows) {
    if (!rangeSnapshotEl) return;
    if (!aggregatedRows.length) {
      rangeSnapshotEl.innerHTML = '<div class="ops-empty">No data in selected range.</div>';
      return;
    }

    const totals = aggregatedRows.reduce((acc, row) => {
      acc.votes += row.votes;
      acc.raw += row.rawScoreTotal;
      row.releases.forEach((title) => acc.releases.add(title));
      return acc;
    }, { votes: 0, raw: 0, releases: new Set() });

    const avg = totals.votes > 0 ? totals.raw / totals.votes : null;
    rangeSnapshotEl.innerHTML = `
      <div class="ops-snapshot-metric"><span>Votes</span><strong>${totals.votes.toLocaleString()}</strong></div>
      <div class="ops-snapshot-metric"><span>Raw score total</span><strong>${totals.raw.toLocaleString()}</strong></div>
      <div class="ops-snapshot-metric"><span>Average score</span><strong>${avg == null ? "—" : avg.toFixed(2)}</strong></div>
      <div class="ops-snapshot-release">${releaseLabel(Array.from(totals.releases))}</div>
    `;
  }

  function findWeeklyBucket(weeklyRows, startDate) {
    const key = utcDateKey(startDate);
    return weeklyRows.find((row) => row.key === key) || null;
  }

  function setWeeklySnapshot(dailyRows) {
    if (!weeklySnapshotEl) return;
    const weeklyRows = aggregateRows(dailyRows, "weekly", state.releasesByDay);
    if (!weeklyRows.length) {
      weeklySnapshotEl.innerHTML = '<div class="ops-empty">No weekly data yet.</div>';
      return;
    }

    const today = new Date();
    const thisWeekStart = saturdayStart(today);
    const lastFullWeekStart = addDays(thisWeekStart, -7);

    const current = findWeeklyBucket(weeklyRows, lastFullWeekStart);
    if (!current) {
      weeklySnapshotEl.innerHTML = '<div class="ops-empty">No completed Saturday–Friday week available.</div>';
      return;
    }

    const previous = findWeeklyBucket(weeklyRows, addDays(lastFullWeekStart, -7));

    const priorFour = [];
    for (let offset = 7; offset <= 28; offset += 7) {
      const bucket = findWeeklyBucket(weeklyRows, addDays(lastFullWeekStart, -offset));
      if (bucket) priorFour.push(bucket);
    }

    const fourAvg = priorFour.length
      ? {
          votes: priorFour.reduce((sum, item) => sum + item.votes, 0) / priorFour.length,
          raw: priorFour.reduce((sum, item) => sum + item.rawScoreTotal, 0) / priorFour.length,
          avgScore: priorFour.reduce((sum, item) => sum + (item.avgScore || 0), 0) / priorFour.length
        }
      : null;

    const prevVotes = previous ? formatDiff(current.votes, previous.votes, 0) : { text: "—", className: "ops-change-flat" };
    const prevRaw = previous ? formatDiff(current.rawScoreTotal, previous.rawScoreTotal, 0) : { text: "—", className: "ops-change-flat" };
    const prevAvg = previous ? formatDiff(current.avgScore || 0, previous.avgScore || 0, 2) : { text: "—", className: "ops-change-flat" };

    const fourVotes = fourAvg ? formatDiff(current.votes, fourAvg.votes, 0) : { text: "—", className: "ops-change-flat" };
    const fourRaw = fourAvg ? formatDiff(current.rawScoreTotal, fourAvg.raw, 0) : { text: "—", className: "ops-change-flat" };
    const fourScore = fourAvg ? formatDiff(current.avgScore || 0, fourAvg.avgScore || 0, 2) : { text: "—", className: "ops-change-flat" };

    weeklySnapshotEl.innerHTML = `
      <div class="ops-snapshot-period">${current.periodLabel}</div>
      <div class="ops-snapshot-metric"><span>Votes</span><strong>${current.votes.toLocaleString()}</strong></div>
      <div class="ops-snapshot-metric"><span>Raw score total</span><strong>${current.rawScoreTotal.toLocaleString()}</strong></div>
      <div class="ops-snapshot-metric"><span>Average score</span><strong>${metricCell(current.avgScore)}</strong></div>
      <div class="ops-snapshot-release">${current.releaseText}</div>
      <div class="ops-compare-block">
        <div class="ops-compare-title">vs previous week</div>
        <div>Votes: <span class="${prevVotes.className}">${prevVotes.text}</span></div>
        <div>Raw score total: <span class="${prevRaw.className}">${prevRaw.text}</span></div>
        <div>Average score: <span class="${prevAvg.className}">${prevAvg.text}</span></div>
      </div>
      <div class="ops-compare-block">
        <div class="ops-compare-title">vs 4-week average</div>
        <div>Votes: <span class="${fourVotes.className}">${fourVotes.text}</span></div>
        <div>Raw score total: <span class="${fourRaw.className}">${fourRaw.text}</span></div>
        <div>Average score: <span class="${fourScore.className}">${fourScore.text}</span></div>
      </div>
    `;
  }

  async function loadMetadataFromManifest() {
    const manifestRes = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!manifestRes.ok) return { byId: new Map(), releasesByDay: new Map() };
    const manifest = await manifestRes.json();
    const filmEntries = Array.isArray(manifest.films) ? manifest.films : [];

    const paths = filmEntries.filter((entry) => entry?.path).map((entry) => ({ path: entry.path, active: entry.active !== false }));
    const films = await Promise.all(paths.map(async ({ path, active }) => {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) return null;
        const film = await res.json();
        return { ...film, manifestActive: active };
      } catch (_error) {
        return null;
      }
    }));

    const byId = new Map();
    const releasesByDay = new Map();
    const now = new Date();

    films.forEach((film) => {
      if (!film?.id) return;
      byId.set(film.id, {
        title: film.title || film.id,
        podcastDate: film.podcastDate || film.podcasted_at || null,
        versionLabel: film.rob ? "Rob’s Version" : ""
      });

      const rawDate = film.podcasted_at || film.podcastDate;
      if (!rawDate || film.manifestActive === false) return;
      const releaseDate = new Date(rawDate);
      if (Number.isNaN(releaseDate.getTime()) || releaseDate > now) return;

      const owner = String(film.owner || "").toLowerCase();
      const isLikelyEpisode = owner === "rob" || owner === "kev" || owner === "kevs";
      if (!isLikelyEpisode) return;

      const key = utcDateKey(releaseDate);
      if (!releasesByDay.has(key)) releasesByDay.set(key, []);
      const items = releasesByDay.get(key);
      if (!items.includes(film.title)) items.push(film.title);
    });

    return { byId, releasesByDay };
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

  async function loadDailyTrendRows(fromDateKey, toDateKey) {
    const baseSelect = supabase
      .from("ops_votes_by_day")
      .select("day,votes,unique_voters,avg_rating,raw_score_total")
      .gte("day", fromDateKey)
      .lte("day", toDateKey)
      .order("day", { ascending: true });

    const { data, error } = await baseSelect;
    if (!error) return { data: data || [], error: null };

    const fallback = await supabase
      .from("ops_votes_by_day_30")
      .select("day,votes,unique_voters,avg_rating")
      .gte("day", fromDateKey)
      .lte("day", toDateKey)
      .order("day", { ascending: true });

    if (fallback.error) return { data: [], error: fallback.error };

    const patched = (fallback.data || []).map((row) => ({
      ...row,
      raw_score_total: Math.round((Number(row.avg_rating) || 0) * (Number(row.votes) || 0))
    }));

    return { data: patched, error: null };
  }

  function updateTrendChart(rows) {
    const canvas = document.getElementById("votesTrendChart30");
    if (!canvas || typeof window.Chart === "undefined") return;

    const labels = rows.map((r) => r.periodLabel);
    const votes = rows.map((r) => r.votes);
    const ctx = canvas.getContext("2d");

    if (votesTrendChart30Instance) votesTrendChart30Instance.destroy();

    votesTrendChart30Instance = new window.Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Votes",
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

  async function loadTrendReporting() {
    if (!supabase || !fromInput || !toInput || !aggregationSelect || !trendStateEl) return;

    trendStateEl.className = "ops-loading";
    trendStateEl.textContent = "Loading vote trends…";

    const from = fromInput.value;
    const to = toInput.value;
    if (!from || !to) return;

    const { data, error } = await loadDailyTrendRows(from, to);
    if (error) {
      trendStateEl.className = "ops-error";
      trendStateEl.textContent = `Could not load trend data: ${error.message}`;
      trendTableBody.innerHTML = "";
      return;
    }

    state.trendDailyRows = data || [];
    const aggregation = aggregationSelect.value || "daily";
    const aggregated = aggregateRows(state.trendDailyRows, aggregation, state.releasesByDay);
    fillTrendTable(aggregated);
    setRangeSnapshot(aggregated);
    setWeeklySnapshot(state.trendDailyRows);
    updateTrendChart(aggregated);
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

    state.releasesByDay = metadata.releasesByDay;

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
      const meta = metadata.byId.get(row.film_id) || {};
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

  function setupTrendDefaults() {
    if (!fromInput || !toInput || !aggregationSelect) return;
    const today = new Date();
    const todayKey = utcDateKey(today);
    const fromKey = utcDateKey(addDays(today, -29));

    fromInput.value = fromKey;
    toInput.value = todayKey;
    aggregationSelect.value = "daily";

    fromInput.addEventListener("change", loadTrendReporting);
    toInput.addEventListener("change", loadTrendReporting);
    aggregationSelect.addEventListener("change", loadTrendReporting);
  }

  async function refreshAll() {
    if (!supabase) {
      stateEl.textContent = "Supabase client is unavailable on this page.";
      stateEl.className = "ops-error";
      return;
    }

    await loadOpsTotals();
    await loadFilmSummary();
    await loadTrendReporting();
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

  setupTrendDefaults();
  refreshAll();
})();
