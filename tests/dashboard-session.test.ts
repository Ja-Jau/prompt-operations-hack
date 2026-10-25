import assert from "node:assert/strict";
import { test } from "node:test";
import { createDashboardSession, SESSION_SECONDS, validDashboardCredentials, validDashboardSession } from "../src/lib/dashboard/session";

test("the demo login accepts admin/admin and rejects other credentials", () => {
  assert.equal(validDashboardCredentials("admin", "admin"), true);
  for (const [username, password] of [["admin", "wrong"], ["wrong", "admin"], ["", ""], [null, null]]) {
    assert.equal(validDashboardCredentials(username, password), false);
  }
});

test("dashboard sessions require the original signature and expire after eight hours", () => {
  const now = 1_800_000_000_000;
  const secret = "test-session-key";
  const token = createDashboardSession(secret, now);
  assert.equal(validDashboardSession(token, secret, now), true);
  assert.equal(validDashboardSession(token, secret, now + 1000), true);
  assert.equal(validDashboardSession(token, "wrong-key", now), false);
  assert.equal(validDashboardSession(token.replace("admin", "other"), secret, now), false);
  assert.equal(validDashboardSession(`${token.slice(0, -1)}!`, secret, now), false);
  assert.equal(validDashboardSession(token, secret, now + SESSION_SECONDS * 1000), false);
  assert.equal(validDashboardSession(undefined, secret, now), false);
  assert.equal(validDashboardSession("admin", secret, now), false);
});
