// Match Next's extensionless ES module resolution for the existing client modules.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (
      error.code === "ERR_MODULE_NOT_FOUND" &&
      specifier.startsWith(".") &&
      !/\.[a-z]+$/i.test(specifier)
    )
      return next(`${specifier}.js`, context);
    throw error;
  }
}
export async function load(url, context, next) {
  if (
    url.endsWith(".js") &&
    (url.includes("/frontend/lib/") ||
      url.includes("/frontend/components/views/"))
  )
    return next(url, { ...context, format: "module" });
  return next(url, context);
}
