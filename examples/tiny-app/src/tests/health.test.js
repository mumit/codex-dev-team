const { test } = require("node:test");
const assert = require("node:assert/strict");
const { health } = require("../backend/health");

test("health reports service readiness", () => {
  assert.deepEqual(health(), {
    ok: true,
    service: "tiny-app",
  });
});
