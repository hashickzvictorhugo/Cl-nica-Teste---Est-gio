import assert from "node:assert/strict";
import test from "node:test";

import {
  applySecurityHeaders,
  CONTENT_SECURITY_POLICY,
  SECURITY_HEADERS,
} from "../lib/security-response.ts";

test("headers de segurança são aplicados no runtime do Worker", async () => {
  const original = new Response("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "X-Custom": "preserved",
    },
  });

  const secured = applySecurityHeaders(original, "/");

  assert.equal(secured.status, 200);
  assert.equal(await secured.text(), "ok");
  assert.equal(secured.headers.get("X-Custom"), "preserved");
  assert.equal(secured.headers.get("Content-Type"), "text/plain");

  for (const [name, value] of SECURITY_HEADERS) {
    assert.equal(secured.headers.get(name), value, `${name} deve estar presente`);
  }
});

test("CSP restringe execução e permite apenas o Turnstile necessário", () => {
  assert.match(CONTENT_SECURITY_POLICY, /default-src 'self'/);
  assert.match(CONTENT_SECURITY_POLICY, /object-src 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /script-src-attr 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /https:\/\/challenges\.cloudflare\.com/);
});

test("admin recebe cache e indexação bloqueados no runtime", () => {
  const secured = applySecurityHeaders(
    new Response("admin", { headers: { "Cache-Control": "public, max-age=3600" } }),
    "/admin",
  );

  assert.equal(secured.headers.get("Cache-Control"), "no-store, max-age=0");
  assert.equal(secured.headers.get("Pragma"), "no-cache");
  assert.equal(secured.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
});

test("rota não administrativa preserva política de cache original", () => {
  const secured = applySecurityHeaders(
    new Response("asset", { headers: { "Cache-Control": "public, max-age=600" } }),
    "/public",
  );

  assert.equal(secured.headers.get("Cache-Control"), "public, max-age=600");
  assert.equal(secured.headers.get("X-Robots-Tag"), null);
});
