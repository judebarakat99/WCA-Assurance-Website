import { test } from "vitest";
import assert from "node:assert/strict";
import { validateHeaderValue } from "node:http";
import { publicAssetUrl } from "@/lib/assets.mjs";

test("public image URLs are safe for HTTP preload headers, including a Pages base path", () => {
  const raw = "/Assets/شعار_الهيئة.png";
  assert.throws(() => validateHeaderValue("Link", `<${raw}>; rel=preload`));
  for (const base of ["", "/WCA-Assurance-Website"]) {
    const url = publicAssetUrl(raw, base);
    assert.doesNotThrow(() =>
      validateHeaderValue("Link", `<${url}>; rel=preload`),
    );
    assert.equal(decodeURI(url), base + raw);
  }
});
