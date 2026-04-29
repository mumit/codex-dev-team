const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readiness } = require("../scripts/status");

describe("status readiness", () => {
  it("classifies empty and active runs", () => {
    assert.equal(readiness([]), "not-started");
    assert.equal(readiness([{ gate: { status: "FAIL" } }]), "in-progress");
    assert.equal(readiness([{ gate: { status: "ESCALATE" } }]), "blocked");
    assert.equal(readiness([{ gate: { status: "INVALID" } }]), "invalid");
    assert.equal(readiness([{ gate: { status: "PASS" } }, { gate: { status: "PASS" } }]), "ready");
  });
});
