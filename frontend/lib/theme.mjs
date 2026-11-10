// Light/dark theme preference. The saved choice wins; without one the page
// follows the operating-system setting through CSS (prefers-color-scheme).
export const THEME_KEY = "wca-theme";

// Runs inline in <head> before first paint, so a saved theme never flashes.
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}})();`;
