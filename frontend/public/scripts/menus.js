document.addEventListener("click", (e) => {
  document.querySelectorAll("details.menu[open]").forEach((d) => {
    if (!d.contains(e.target) || e.target.closest(".pop button,.pop a"))
      d.removeAttribute("open");
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape")
    document
      .querySelectorAll("details.menu[open]")
      .forEach((d) => d.removeAttribute("open"));
});
