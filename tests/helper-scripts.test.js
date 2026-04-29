const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

describe("helper scripts", () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-helper-"));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("security heuristic requires review for sensitive paths", () => {
    const result = spawnSync(process.execPath, [
      path.join(ROOT, "scripts", "security-heuristic.js"),
      "src/backend/auth/session.js",
    ], {
      cwd: tmp,
      encoding: "utf8",
    });

    assert.equal(result.status, 2);
    assert.match(result.stdout, /SECURITY_REVIEW: required/);
  });

  it("security heuristic skips ordinary docs", () => {
    const result = spawnSync(process.execPath, [
      path.join(ROOT, "scripts", "security-heuristic.js"),
      "docs/readme.md",
    ], {
      cwd: tmp,
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /SECURITY_REVIEW: skip/);
  });

  it("runbook check enforces required sections", () => {
    fs.mkdirSync(path.join(tmp, "pipeline"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "pipeline", "runbook.md"), "# Runbook\n\n## Rollback\n");

    const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "runbook-check.js")], {
      cwd: tmp,
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Health signals/);
  });

  it("runbook check passes valid runbooks", () => {
    fs.mkdirSync(path.join(tmp, "pipeline"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "pipeline", "runbook.md"), [
      "# Runbook",
      "",
      "## Rollback",
      "Revert commit.",
      "",
      "## Health signals",
      "Smoke test.",
      "",
    ].join("\n"));

    const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "runbook-check.js")], {
      cwd: tmp,
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Runbook OK/);
  });
});
