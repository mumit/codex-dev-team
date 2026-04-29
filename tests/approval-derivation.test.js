const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const SCRIPT = path.resolve(__dirname, "..", "scripts", "approval-derivation.js");

describe("approval derivation", () => {
  let tmp;
  let reviewDir;
  let gatesDir;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-review-"));
    reviewDir = path.join(tmp, "pipeline", "code-review");
    gatesDir = path.join(tmp, "pipeline", "gates");
    fs.mkdirSync(reviewDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function run() {
    return execFileSync(process.execPath, [SCRIPT], {
      cwd: tmp,
      encoding: "utf8",
    });
  }

  function gate(name) {
    return JSON.parse(fs.readFileSync(path.join(gatesDir, name), "utf8"));
  }

  it("creates a review gate from an approval marker", () => {
    fs.writeFileSync(path.join(reviewDir, "by-frontend.md"), [
      "## Review of backend",
      "Looks good.",
      "REVIEW: APPROVED",
      "",
    ].join("\n"));

    const output = run();
    assert.match(output, /frontend -> APPROVED on backend/);
    assert.deepEqual(gate("stage-05-backend.json").approvals, ["frontend"]);
  });

  it("honors scoped gates with one required approval", () => {
    fs.mkdirSync(gatesDir, { recursive: true });
    fs.writeFileSync(path.join(gatesDir, "stage-05-backend.json"), JSON.stringify({
      stage: "stage-05-backend",
      status: "FAIL",
      agent: "codex-team",
      track: "quick",
      timestamp: "2026-04-29T12:00:00Z",
      blockers: [],
      warnings: [],
      area: "backend",
      review_shape: "scoped",
      required_approvals: 1,
      approvals: [],
      changes_requested: [],
      escalated_to_principal: false,
    }));
    fs.writeFileSync(path.join(reviewDir, "by-qa.md"), [
      "## Review of backend",
      "REVIEW: APPROVED",
      "",
    ].join("\n"));

    run();
    assert.equal(gate("stage-05-backend.json").status, "PASS");
  });

  it("records changes requested and removes prior approval", () => {
    fs.writeFileSync(path.join(reviewDir, "by-platform.md"), [
      "## Review of frontend",
      "REVIEW: APPROVED",
      "",
    ].join("\n"));
    run();
    fs.writeFileSync(path.join(reviewDir, "by-platform.md"), [
      "## Review of frontend",
      "BLOCKER: missing test",
      "REVIEW: CHANGES REQUESTED",
      "",
    ].join("\n"));
    run();

    const result = gate("stage-05-frontend.json");
    assert.deepEqual(result.approvals, []);
    assert.equal(result.changes_requested[0].reviewer, "platform");
  });
});
