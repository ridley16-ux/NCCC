(() => {
  const includeTargets = document.querySelectorAll('[data-include="header"]');
  if (!includeTargets.length) {
    return;
  }

  const normalizePath = (path) => {
    if (!path || path === "/") {
      return "index.html";
    }
    const cleaned = path.split("?")[0].split("#")[0];
    const segments = cleaned.split("/").filter(Boolean);
    return segments[segments.length - 1] || "index.html";
  };

  includeTargets.forEach((target) => {
    fetch("assets/header.html")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Header fetch failed: ${response.status}`);
        }
        return response.text();
      })
      .then((html) => {
        target.innerHTML = html;

        const header = target.querySelector(".site-header");
        const updateHeaderHeight = () => {
          if (!header) {
            return;
          }
          document.documentElement.style.setProperty(
            "--site-header-height",
            `${header.offsetHeight}px`
          );
        };
        updateHeaderHeight();
        window.addEventListener("resize", updateHeaderHeight);

        const currentPage = normalizePath(window.location.pathname);
        const navLinks = target.querySelectorAll(".primary-nav a");
        navLinks.forEach((link) => {
          const linkPage = normalizePath(link.getAttribute("href"));
          if (linkPage === currentPage) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
          } else {
            link.classList.remove("active");
            link.removeAttribute("aria-current");
          }
        });
      })
      .catch((error) => {
        console.warn("Failed to load header partial:", error);
      });
  });
})();
