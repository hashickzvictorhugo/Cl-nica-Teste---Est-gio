import assert from "node:assert/strict";
import test from "node:test";

import { JsonBodyError, readJsonObject } from "../lib/request-json.ts";

test("readJsonObject aceita objeto JSON dentro do limite", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientName: "Maria" }),
  });

  assert.deepEqual(await readJsonObject(request), { patientName: "Maria" });
});

test("readJsonObject rejeita JSON inválido", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
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
    body: JSON.stringify(["x"]),
  });

  await assert.rejects(
    () => readJsonObject(request),
    (error: unknown) => error instanceof JsonBodyError && error.code === "VALIDATION_ERROR",
  );
});

test("readJsonObject mede bytes reais mesmo sem Content-Length confiável", async () => {
  const oversized = JSON.stringify({ payload: "á".repeat(100) });
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { "Content-Length": "1" },
    body: oversized,
  });

  await assert.rejects(
    () => readJsonObject(request, 64),
    (error: unknown) => error instanceof JsonBodyError && error.status === 413,
  );
});
