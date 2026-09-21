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
  setOnlineStatus();
  showConnectionInfo();
})();
