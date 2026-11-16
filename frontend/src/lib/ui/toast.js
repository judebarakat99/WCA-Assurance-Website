// Short status message in the #toastRoot region (rendered by the root layout).
export function toast(msg) {
  const root = document.querySelector("#toastRoot");
  if (!root) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = msg;
  root.replaceChildren(el);
  clearTimeout(toast.t);
  toast.t = setTimeout(() => root.replaceChildren(), 3200);
}
