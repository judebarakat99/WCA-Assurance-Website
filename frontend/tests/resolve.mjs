// Node test loader that mirrors the Next.js setup: the "@/" alias points at
// src/, and extensionless relative or aliased imports resolve to ".js".
import { pathToFileURL } from "node:url";

const SRC = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    specifier = new URL(specifier.slice(2), SRC).href;
  }
  try {
    return await next(specifier, context);
  } catch (error) {
    const local = specifier.startsWith(".") || specifier.startsWith("file:");
    if (error.code === "ERR_MODULE_NOT_FOUND" && local && !/\.[a-z]+$/i.test(specifier))
      return next(`${specifier}.js`, context);
    throw error;
  }
}

// Source .js files are ES modules (package.json has no "type": "module").
export async function load(url, context, next) {
  if (url.endsWith(".js") && url.startsWith(pathToFileURL(SRC.pathname).href))
    return next(url, { ...context, format: "module" });
  return next(url, context);
}
