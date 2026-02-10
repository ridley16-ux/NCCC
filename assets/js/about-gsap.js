(() => {
  if (typeof window === "undefined" || typeof gsap === "undefined") {
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    return;
  }

  if (typeof ScrollTrigger === "undefined") {
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ overwrite: "auto" });

  const heroImage = document.querySelector(".about-hero");
  const heroTitle = document.querySelector(".about-title");
  const heroIntro = document.querySelector(".about-intro");

  const heroTl = gsap.timeline();
  if (heroImage) {
    heroTl.fromTo(
      heroImage,
      { opacity: 0, scale: 1.03 },
      { opacity: 1, scale: 1, duration: 0.9, ease: "power2.out" }
    );
  }

  if (heroTitle) {
    heroTl.fromTo(
      heroTitle,
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", delay: 0.1 },
      heroImage ? "<" : 0
    );
  }

  if (heroIntro) {
    heroTl.fromTo(
      heroIntro,
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", delay: 0.25 },
      heroTitle || heroImage ? "<" : 0
    );
  }

  const sectionHeadings = document.querySelectorAll("h3");
  sectionHeadings.forEach((heading) => {
    gsap.fromTo(
      heading,
      { y: 12, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.45,
        ease: "power2.out",
        scrollTrigger: {
          trigger: heading,
          start: "top 80%"
        }
      }
    );

    const contentBlock = heading.nextElementSibling;
    if (contentBlock) {
      gsap.fromTo(
        contentBlock,
        { y: 10, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.4,
          delay: 0.08,
          ease: "power2.out",
          scrollTrigger: {
            trigger: heading,
            start: "top 80%"
          }
        }
      );
    }
  });

  const hostCards = document.querySelectorAll(".host-card");
  hostCards.forEach((card) => {
    const icon = card.querySelector(".host-icon");
    const name = card.querySelector(".host-name");
    const role = card.querySelector(".host-role");
    const points = card.querySelectorAll(".host-points li");

    const cardTl = gsap.timeline({
      scrollTrigger: {
        trigger: card,
        start: "top 85%"
      }
    });

    cardTl.fromTo(
      card,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }
    );

    if (icon) {
      cardTl.fromTo(
        icon,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" },
        "-=0.25"
      );
    }

    const nameRole = [name, role].filter(Boolean);
    if (nameRole.length) {
      cardTl.fromTo(
        nameRole,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.08, ease: "power2.out" },
        "-=0.2"
      );
    }

    if (points.length) {
      cardTl.fromTo(
        points,
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, duration: 0.3, stagger: 0.08, ease: "power2.out" },
        "-=0.12"
      );
    }
  });

  const expectList = document.querySelector(".about-what-to-expect");
  if (expectList) {
    const expectItems = expectList.querySelectorAll("li");
    if (expectItems.length) {
      gsap.fromTo(
        expectItems,
        { opacity: 0, x: -10 },
        {
          opacity: 1,
          x: 0,
          duration: 0.35,
          stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: {
            trigger: expectList,
            start: "top 80%"
          }
        }
      );
    }
  }

  const subscribeCta = document.querySelector(".subscribe-cta");
  const subscribeLink = subscribeCta?.querySelector("a.button");
  if (subscribeCta && subscribeLink) {
    let pulseTween;

    ScrollTrigger.create({
      trigger: subscribeCta,
      start: "top 85%",
      end: "bottom top",
      onEnter: () => {
        pulseTween = gsap.to(subscribeLink, {
          scale: 1.03,
          duration: 1.2,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut"
        });
      },
      onEnterBack: () => {
        pulseTween = gsap.to(subscribeLink, {
          scale: 1.03,
          duration: 1.2,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut"
        });
      },
      onLeave: () => {
        if (pulseTween) {
          pulseTween.kill();
          pulseTween = null;
        }
        gsap.set(subscribeLink, { scale: 1 });
      },
      onLeaveBack: () => {
        if (pulseTween) {
          pulseTween.kill();
          pulseTween = null;
        }
        gsap.set(subscribeLink, { scale: 1 });
      }
    });
  }
})();
