import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "public/scripts/**", "public/vendor/**"]),
  { rules: { "@next/next/no-img-element": "off" } },
]);
