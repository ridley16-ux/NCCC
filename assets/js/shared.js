(() => {
  const VISITOR_ID_KEY = "nccc_visitor_id";

  function generateFallbackUUID() {
    const bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return (
      `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-` +
      `${hex[4]}${hex[5]}-` +
      `${hex[6]}${hex[7]}-` +
      `${hex[8]}${hex[9]}-` +
      `${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
    );
  }

  function getVisitorId() {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const created = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : generateFallbackUUID();
    localStorage.setItem(VISITOR_ID_KEY, created);
    return created;
  }

  function updateStickyHeaderHeight() {
    const headerEl = document.querySelector("#site-header .site-header");
    if (!headerEl) {
      document.documentElement.style.setProperty("--sticky-header-h", "0px");
      if (document.body) {
        document.body.style.paddingTop = "0px";
      }
      return;
    }
    const height = `${headerEl.offsetHeight}px`;
    document.documentElement.style.setProperty("--sticky-header-h", height);
    if (document.body) {
      document.body.style.paddingTop = height;
    }
  }

  function observeSiteHeader() {
    const host = document.getElementById("site-header");
    if (!host) {
      return;
    }

    const observer = new MutationObserver(() => {
      updateStickyHeaderHeight();
    });
    observer.observe(host, { childList: true, subtree: true });
  }

  window.getVisitorId = getVisitorId;

  try {
    document.documentElement.style.overflowX = CSS.supports("overflow", "clip") ? "clip" : "hidden";
  } catch (error) {
    document.documentElement.style.overflowX = "hidden";
  }

  window.addEventListener("resize", updateStickyHeaderHeight, { passive: true });
  window.addEventListener("load", updateStickyHeaderHeight);
  document.addEventListener("header:ready", updateStickyHeaderHeight);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      observeSiteHeader();
      updateStickyHeaderHeight();
    }, { once: true });
  } else {
    observeSiteHeader();
    updateStickyHeaderHeight();
  }
})();
