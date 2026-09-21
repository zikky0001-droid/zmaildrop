(() => {
  "use strict";

  const menu = document.querySelector("[data-mobile-menu]");
  const toggle = document.querySelector("[data-menu-toggle]");
  const closers = document.querySelectorAll("[data-menu-close]");
  if (!menu || !toggle) return;

  function setOpen(open) {
    menu.classList.toggle("open", open);
    document.querySelector(".menu-backdrop")?.classList.toggle("open", open);
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
  }

  toggle.addEventListener("click", () => setOpen(!menu.classList.contains("open")));
  closers.forEach(el => el.addEventListener("click", () => setOpen(false)));
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") setOpen(false);
  });
})();
