(() => {
  "use strict";

  const zone = "Africa/Lagos";
  const timeFormatter = new Intl.DateTimeFormat("en-NG", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const dateFormatter = new Intl.DateTimeFormat("en-NG", {
    timeZone: zone,
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  function updateClock() {
    const now = new Date();
    const time = timeFormatter.format(now);
    document.querySelectorAll("[data-lagos-clock]").forEach(el => {
      el.textContent = time;
      el.title = `Africa/Lagos · ${dateFormatter.format(now)}`;
    });
    document.querySelectorAll("[data-lagos-date]").forEach(el => {
      el.textContent = dateFormatter.format(now);
    });
  }

  window.ZMAILClock = { zone, update: updateClock };
  updateClock();
  window.setInterval(updateClock, 1000);
})();
