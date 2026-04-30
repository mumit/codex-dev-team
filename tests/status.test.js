const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { contextSignals, readiness, statusPayload } = require("../scripts/status");

describe("status readiness", () => {
  it("classifies empty and active runs", () => {
    assert.equal(readiness([]), "not-started");
    assert.equal(readiness([{ gate: { status: "FAIL" } }]), "in-progress");
    assert.equal(readiness([{ gate: { status: "ESCALATE" } }]), "blocked");
    assert.equal(readiness([{ gate: { status: "INVALID" } }]), "invalid");
    assert.equal(readiness([{ gate: { status: "PASS" } }, { gate: { status: "PASS" } }]), "ready");
  });

  it("summarizes context decision-flow signals", () => {
    const originalCwd = process.cwd();
    const target = fs.mkdtempSync(path.join(os.tmpdir(), "codex-status-"));

    try {
      fs.mkdirSync(path.join(target, "pipeline"), { recursive: true });
      fs.writeFileSync(path.join(target, "pipeline", "context.md"), [
        "# Project Context",
        "",
        "QUESTION: Which tenants are in scope?",
        "PM-ANSWER: Enterprise tenants only.",
        "QUESTION: Should beta users see this?",
        "PRINCIPAL-RULING-REQUEST: Should review conflicts be escalated?",
        "2026-04-30T00:00:00.000Z - RESUME: stage-04 (build) - design approved",
        "2026-04-30T00:00:01.000Z - ADR 0001: Use webhooks",
        "",
      ].join("\n"));

      process.chdir(target);
      const signals = contextSignals();
      assert.equal(signals.questions.total, 2);
      assert.equal(signals.questions.answered, 1);
      assert.equal(signals.questions.open, 1);
      assert.deepEqual(signals.questions.latestOpen, ["Should beta users see this?"]);
      assert.equal(signals.principalRulingRequests.total, 1);
      assert.equal(signals.resumes.total, 1);
      assert.equal(signals.keyDecisions.total, 1);

      const payload = statusPayload();
      assert.equal(payload.context.questions.open, 1);
      assert.equal(payload.context.principalRulingRequests.latest[0], "Should review conflicts be escalated?");
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
});
