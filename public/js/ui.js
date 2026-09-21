(() => {
  "use strict";

  document.documentElement.classList.add("js-ready");

  const reveal = () => {
    const items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(el => el.classList.add("visible"));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    items.forEach(el => observer.observe(el));
  };

  const initProgress = () => {
    const bar = document.querySelector(".site-progress");
    if (!bar) return;
    bar.style.transformOrigin = "0 50%";
    const onScroll = () => {
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      const p = max > 0 ? root.scrollTop / max : 0;
      bar.style.transform = "scaleX(" + p + ")";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
  };

  const initFaq = () => {
    const faqs = document.querySelectorAll(".faq-list .faq");
    faqs.forEach(d => {
      d.addEventListener("toggle", () => {
        if (!d.open) return;
        faqs.forEach(other => {
          if (other !== d) other.open = false;
        });
      });
    });
  };

  const initCounters = () => {
    const els = document.querySelectorAll("[data-count]");
    if (!els.length) return;
    const run = el => {
      const target = parseFloat(el.dataset.count) || 0;
      const suffix = el.dataset.suffix || "";
      const dur = 1200;
      const t0 = performance.now();
      const tick = t => {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (!("IntersectionObserver" in window)) {
      els.forEach(run);
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          io.unobserve(entry.target);
          run(entry.target);
        }
      });
    }, { threshold: 0.4 });
    els.forEach(el => io.observe(el));
  };

  const initWordSwap = () => {
    const el = document.querySelector("[data-word-swap]");
    if (!el) return;
    const words = (el.dataset.words || "").split(",").map(w => w.trim()).filter(Boolean);
    if (words.length < 2) return;
    let i = 0;
    window.setInterval(() => {
      el.classList.add("out");
      window.setTimeout(() => {
        i = (i + 1) % words.length;
        el.textContent = words[i];
        el.classList.remove("out");
      }, 280);
    }, 2600);
  };

  const setOnlineStatus = () => {
    document.querySelectorAll("[data-online-status]").forEach(el => {
      el.textContent = navigator.onLine ? "Online" : "Offline";
    });
  };

  const showConnectionInfo = () => {
    const elements = document.querySelectorAll("[data-ip-address]");
    if (!elements.length) return;

    fetch("/api/ip", { headers: { Accept: "application/json" } })
      .then(res => {
        if (!res.ok) throw new Error("IP endpoint unavailable");
        return res.json();
      })
      .then(data => {
        const ip = data.ip || data.address || "Unavailable";
        elements.forEach(el => el.textContent = ip);
      })
      .catch(() => elements.forEach(el => el.textContent = "Unavailable"));
  };

  window.addEventListener("online", setOnlineStatus);
  window.addEventListener("offline", setOnlineStatus);

  reveal();
  initProgress();
  initFaq();
  initCounters();
  initWordSwap();
  setOnlineStatus();
  showConnectionInfo();
})();


