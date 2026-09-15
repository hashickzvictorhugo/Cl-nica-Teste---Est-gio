import assert from "node:assert/strict";
import test from "node:test";

import { JsonBodyError, readJsonObject } from "../lib/request-json.ts";

const jsonHeaders = { "Content-Type": "application/json" };

test("readJsonObject aceita objeto JSON dentro do limite", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ patientName: "Maria" }),
  });

  assert.deepEqual(await readJsonObject(request), { patientName: "Maria" });
});

test("readJsonObject exige Content-Type application/json", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ patientName: "Maria" }),
  });

  await assert.rejects(
    () => readJsonObject(request),
    (error: unknown) =>
      error instanceof JsonBodyError &&
      error.status === 415 &&
      error.code === "UNSUPPORTED_MEDIA_TYPE",
  );
});

test("readJsonObject rejeita JSON inválido", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    headers: jsonHeaders,
    body: "{invalid",
  });

  await assert.rejects(
    () => readJsonObject(request),
    (error: unknown) => error instanceof JsonBodyError && error.status === 400,
  );
});

test("readJsonObject rejeita array no lugar de objeto", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(["x"]),
  });

  await assert.rejects(
    () => readJsonObject(request),
    (error: unknown) => error instanceof JsonBodyError && error.code === "VALIDATION_ERROR",
  );
});

test("readJsonObject mede bytes reais mesmo com Content-Length enganoso", async () => {
  const oversized = JSON.stringify({ payload: "á".repeat(100) });
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { ...jsonHeaders, "Content-Length": "1" },
    body: oversized,
  });

  await assert.rejects(
    () => readJsonObject(request, 64),
    (error: unknown) => error instanceof JsonBodyError && error.status === 413,
  );
});
