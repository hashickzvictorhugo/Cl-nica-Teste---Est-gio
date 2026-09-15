import assert from "node:assert/strict";
import test from "node:test";

import {
  canMutateAdmin,
  classifyAdminCredential,
} from "../lib/admin-access.ts";

test("credencial administrativa completa recebe acesso full", async () => {
  assert.equal(
    await classifyAdminCredential({
      suppliedToken: "full-secret",
      adminToken: "full-secret",
      demoToken: "demo-secret",
    }),
    "full",
  );
});

test("credencial de demonstração recebe acesso demo", async () => {
  assert.equal(
    await classifyAdminCredential({
      suppliedToken: "demo-secret",
      adminToken: "full-secret",
      demoToken: "demo-secret",
    }),
    "demo",
  );
});

test("credencial inválida não autentica", async () => {
  assert.equal(
    await classifyAdminCredential({
      suppliedToken: "wrong-secret",
      adminToken: "full-secret",
      demoToken: "demo-secret",
    }),
    null,
  );
});

test("acesso demo nunca pode mutar a operação", () => {
  assert.equal(canMutateAdmin("demo"), false);
  assert.equal(canMutateAdmin("full"), true);
});

test("se os dois secrets coincidirem, prevalece acesso full", async () => {
  assert.equal(
    await classifyAdminCredential({
      suppliedToken: "same-secret",
      adminToken: "same-secret",
      demoToken: "same-secret",
    }),
    "full",
  );
});
