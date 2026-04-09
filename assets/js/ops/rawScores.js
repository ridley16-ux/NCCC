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
  const analysisStateEl = document.getElementById("ops-analysis-state");
  const analysisTableBody = document.getElementById("ops-analysis-table-body");
  const dateFromInput = document.getElementById("ops-date-from");
  const dateToInput = document.getElementById("ops-date-to");
  const groupBySelect = document.getElementById("ops-group-by");
  const weeklyStateEl = document.getElementById("ops-weekly-state");
  const weeklyKpisEl = document.getElementById("ops-weekly-kpis");
  const weeklyTableBody = document.getElementById("ops-weekly-table-body");

  let votesTrendChart30Instance = null;
  let metadataById = new Map();
  let dailyRows = [];

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

  function toDateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function startOfDayLocal(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function startOfWeekSaturday(date) {
    const day = date.getDay();
    const delta = (day + 1) % 7;
    return addDays(startOfDayLocal(date), -delta);
  }

  function endOfWeekFriday(date) {
    return addDays(startOfWeekSaturday(date), 6);
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function parseDay(dayString) {
    const date = new Date(`${dayString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return startOfDayLocal(date);
  }

  function getDayRangeFromInputs() {
    const now = startOfDayLocal(new Date());
    const defaultTo = now;
    const defaultFrom = addDays(defaultTo, -29);

    const from = dateFromInput?.value ? parseDay(dateFromInput.value) : defaultFrom;
    const to = dateToInput?.value ? parseDay(dateToInput.value) : defaultTo;

    if (!from || !to) {
      return { from: defaultFrom, to: defaultTo };
    }

    if (from <= to) return { from, to };
    return { from: to, to: from };
  }

  function scoreColorClass(changeValue) {
    if (changeValue == null || Number.isNaN(changeValue)) return "ops-change-neutral";
    if (changeValue > 0) return "ops-change-good";
    if (changeValue < 0) return "ops-change-bad";
    return "ops-change-neutral";
  }

  function formatPercent(value) {
    if (value == null || Number.isNaN(value)) return "—";
    return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  }

  function formatDelta(value) {
    if (value == null || Number.isNaN(value)) return "—";
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
  }

  function releaseLabel(meta) {
    if (!meta) return "";
    const date = fmtDateOnly(meta.podcastDate);
    return `${meta.title || "Unknown"} (${date})`;
  }

  function buildReleaseBuckets(groupBy, from, to) {
    const buckets = new Map();

    metadataById.forEach((meta) => {
      if (!meta?.podcastDate) return;
      const releaseDate = parseDay(meta.podcastDate);
      if (!releaseDate) return;
      if (releaseDate < from || releaseDate > to) return;

      let key;
      if (groupBy === "monthly") {
        key = toDateKey(startOfMonth(releaseDate));
      } else if (groupBy === "weekly") {
        key = toDateKey(startOfWeekSaturday(releaseDate));
      } else {
        key = toDateKey(releaseDate);
      }

      const current = buckets.get(key) || [];
      current.push(releaseLabel(meta));
      buckets.set(key, current);
    });

    return buckets;
  }

  function aggregateTimelineRows(rows, groupBy, from, to) {
    const grouped = new Map();

    rows.forEach((row) => {
      const day = parseDay(row.day);
      if (!day || day < from || day > to) return;

      let keyDate;
      let label;
      if (groupBy === "monthly") {
        keyDate = startOfMonth(day);
        label = keyDate.toLocaleDateString(undefined, { year: "numeric", month: "short" });
      } else if (groupBy === "weekly") {
        const weekStart = startOfWeekSaturday(day);
        const weekEnd = endOfWeekFriday(day);
        keyDate = weekStart;
        label = `${fmtDateOnly(weekStart)} to ${fmtDateOnly(weekEnd)}`;
      } else {
        keyDate = day;
        label = fmtDateOnly(day);
      }

      const key = toDateKey(keyDate);
      const current = grouped.get(key) || {
        key,
        keyDate,
        label,
        votes: 0,
        rawScoreTotal: 0
      };

      const votes = Number(row.votes) || 0;
      const avgRating = Number(row.avg_rating);
      const raw = Number.isFinite(avgRating) ? avgRating * votes : 0;

      current.votes += votes;
      current.rawScoreTotal += raw;
      grouped.set(key, current);
    });

    return [...grouped.values()]
      .sort((a, b) => a.keyDate - b.keyDate)
      .map((item) => ({
        ...item,
        averageScore: item.votes > 0 ? item.rawScoreTotal / item.votes : null
      }));
  }

  function applyTimelineAnalysis() {
    if (!analysisStateEl || !analysisTableBody) return;

    const { from, to } = getDayRangeFromInputs();
    const groupBy = groupBySelect?.value || "daily";

    const aggregated = aggregateTimelineRows(dailyRows, groupBy, from, to);
    const releaseBuckets = buildReleaseBuckets(groupBy, from, to);

    if (!aggregated.length) {
      analysisStateEl.className = "ops-empty";
      analysisStateEl.textContent = "No timeline data found for selected range.";
      analysisTableBody.innerHTML = "";
      return;
    }

    analysisStateEl.className = "";
    analysisStateEl.textContent = "";
    analysisTableBody.innerHTML = "";

    aggregated.forEach((row) => {
      const releases = releaseBuckets.get(row.key) || [];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.label}</td>
        <td>${releases.length ? releases.join("<br />") : "—"}</td>
        <td>${row.votes.toLocaleString()}</td>
        <td>${row.rawScoreTotal.toFixed(2)}</td>
        <td>${row.averageScore == null ? "—" : row.averageScore.toFixed(2)}</td>
      `;
      analysisTableBody.appendChild(tr);
    });
  }

  function calculateWeeklyStats(referenceDate) {
    const currentWeekEnd = addDays(startOfWeekSaturday(referenceDate), -1);
    const currentWeekStart = addDays(currentWeekEnd, -6);

    const statsForRange = (fromDate, toDate) => {
      let votes = 0;
      let rawScoreTotal = 0;
      let dayCount = 0;

      dailyRows.forEach((row) => {
        const day = parseDay(row.day);
        if (!day || day < fromDate || day > toDate) return;
        dayCount += 1;
        const rowVotes = Number(row.votes) || 0;
        const avgRating = Number(row.avg_rating);
        votes += rowVotes;
        rawScoreTotal += Number.isFinite(avgRating) ? rowVotes * avgRating : 0;
      });

      return {
        votes,
        rawScoreTotal,
        averageScore: votes > 0 ? rawScoreTotal / votes : null,
        hasData: dayCount > 0
      };
    };

    const current = statsForRange(currentWeekStart, currentWeekEnd);

    const prevWeekEnd = addDays(currentWeekStart, -1);
    const prevWeekStart = addDays(prevWeekEnd, -6);
    const previous = statsForRange(prevWeekStart, prevWeekEnd);

    const avgRanges = [0, 1, 2, 3].map((offset) => {
      const end = addDays(currentWeekStart, -1 - (offset * 7));
      const start = addDays(end, -6);
      return statsForRange(start, end);
    });

    const fourWeekAverage = {
      votes: avgRanges.reduce((sum, item) => sum + item.votes, 0) / 4,
      rawScoreTotal: avgRanges.reduce((sum, item) => sum + item.rawScoreTotal, 0) / 4,
      averageScore: (() => {
        const totalVotes = avgRanges.reduce((sum, item) => sum + item.votes, 0);
        const totalRaw = avgRanges.reduce((sum, item) => sum + item.rawScoreTotal, 0);
        return totalVotes > 0 ? totalRaw / totalVotes : null;
      })(),
      hasData: avgRanges.some((item) => item.hasData)
    };

    return {
      label: `${fmtDateOnly(currentWeekStart)} to ${fmtDateOnly(currentWeekEnd)}`,
      current,
      previous,
      fourWeekAverage
    };
  }

  function calcComparison(current, baseline, baselineAvailable) {
    if (!baselineAvailable || baseline == null || Number.isNaN(baseline)) {
      return { abs: null, percent: null };
    }

    const abs = current - baseline;
    if (baseline === 0) {
      return { abs, percent: null };
    }

    return {
      abs,
      percent: (abs / baseline) * 100
    };
  }

  function weeklyComparisonRows(snapshot) {
    const metrics = [
      { key: "votes", label: "Votes" },
      { key: "rawScoreTotal", label: "Raw score total" },
      { key: "averageScore", label: "Average score" }
    ];

    const rows = [];

    [
      { label: "vs previous week", baseline: snapshot.previous },
      { label: "vs 4-week avg", baseline: snapshot.fourWeekAverage }
    ].forEach((comparison) => {
      metrics.forEach((metric) => {
        const currentValue = snapshot.current[metric.key];
        const baselineValue = comparison.baseline[metric.key];
        const change = calcComparison(currentValue ?? 0, baselineValue, comparison.baseline.hasData);

        rows.push({
          comparison: comparison.label,
          metric: metric.label,
          current: currentValue,
          baseline: baselineValue,
          baselineAvailable: comparison.baseline.hasData,
          abs: change.abs,
          percent: change.percent
        });
      });
    });

    return rows;
  }

  function formatMetricValue(metric, value, available = true) {
    if (!available) return "—";
    if (value == null || Number.isNaN(value)) return "—";
    if (metric === "Average score") return Number(value).toFixed(2);
    return Number(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  function renderWeeklySnapshot() {
    if (!weeklyStateEl || !weeklyTableBody || !weeklyKpisEl) return;

    const snapshot = calculateWeeklyStats(startOfDayLocal(new Date()));
    const noCurrentWeekData = !snapshot.current.hasData;

    weeklyKpisEl.hidden = false;
    weeklyKpisEl.innerHTML = `
      <div class="ops-kpi-card">
        <span class="ops-kpi-label">Week</span>
        <span class="ops-kpi-value">${snapshot.label}</span>
      </div>
      <div class="ops-kpi-card">
        <span class="ops-kpi-label">Votes</span>
        <span class="ops-kpi-value">${snapshot.current.votes.toLocaleString()}</span>
      </div>
      <div class="ops-kpi-card">
        <span class="ops-kpi-label">Raw score total</span>
        <span class="ops-kpi-value">${snapshot.current.rawScoreTotal.toFixed(2)}</span>
      </div>
      <div class="ops-kpi-card">
        <span class="ops-kpi-label">Average score</span>
        <span class="ops-kpi-value">${snapshot.current.averageScore == null ? "—" : snapshot.current.averageScore.toFixed(2)}</span>
      </div>
    `;

    weeklyTableBody.innerHTML = "";
    const rows = weeklyComparisonRows(snapshot);

    rows.forEach((row) => {
      const absClass = scoreColorClass(row.abs);
      const pctClass = scoreColorClass(row.percent);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.comparison}</td>
        <td>${row.metric}</td>
        <td>${formatMetricValue(row.metric, row.current)}</td>
        <td>${formatMetricValue(row.metric, row.baseline, row.baselineAvailable)}</td>
        <td class="${absClass}">${formatDelta(row.abs)}</td>
        <td class="${pctClass}">${formatPercent(row.percent)}</td>
      `;
      weeklyTableBody.appendChild(tr);
    });

    if (noCurrentWeekData) {
      weeklyStateEl.className = "ops-empty";
      weeklyStateEl.textContent = "No data available for the last full Saturday–Friday week.";
    } else {
      weeklyStateEl.className = "";
      weeklyStateEl.textContent = "";
    }
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

    dailyRows = data || [];

    if (dateFromInput && dateToInput && !dateFromInput.value && !dateToInput.value) {
      const now = startOfDayLocal(new Date());
      dateToInput.value = toDateKey(now);
      dateFromInput.value = toDateKey(addDays(now, -29));
    }

    applyTimelineAnalysis();
    renderWeeklySnapshot();

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

    metadataById = metadata;

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
      const votes = Number(row.votes_total || 0);
      const averageScore = Number(row.avg_rating);
      const rawScoreTotal = Number.isFinite(averageScore) ? averageScore * votes : 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <span class="ops-film-title">${meta.title || row.film_id}</span>
          <span class="ops-film-date">Podcasted: ${fmtDateOnly(meta.podcastDate)}</span>
        </td>
        <td>${votes.toLocaleString()}</td>
        <td>${rawScoreTotal.toFixed(2)}</td>
        <td>${fmtRelative(row.last_vote_at)}</td>
        <td>${Number(row.votes_last_24h || 0).toLocaleString()}</td>
        <td>${Number.isFinite(averageScore) ? averageScore.toFixed(2) : "—"}</td>
      `;
      tableBody.appendChild(tr);
    });

    applyTimelineAnalysis();
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

  dateFromInput?.addEventListener("change", applyTimelineAnalysis);
  dateToInput?.addEventListener("change", applyTimelineAnalysis);
  groupBySelect?.addEventListener("change", applyTimelineAnalysis);

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
