const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const CLI = path.join(ROOT, "scripts", "codex-team.js");

describe("codex-team CLI", () => {
  let target;

  beforeEach(() => {
    target = fs.mkdtempSync(path.join(os.tmpdir(), "codex-cli-"));
    execFileSync("bash", [path.join(ROOT, "bootstrap.sh"), target], {
      cwd: ROOT,
      encoding: "utf8",
    });
  });

  afterEach(() => {
    fs.rmSync(target, { recursive: true, force: true });
  });

  function run(command) {
    return spawnSync(process.execPath, [CLI, command], {
      cwd: target,
      encoding: "utf8",
    });
  }

  it("doctor validates installed framework files", () => {
    const result = run("doctor");
    assert.equal(result.status, 0);
    assert.match(result.stdout, /PASS AGENTS\.md/);
    assert.match(result.stdout, /PASS scripts\/gate-validator\.js/);
  });

  it("validate runs syntax lint and gate validation", () => {
    const result = run("validate");
    assert.equal(result.status, 0);
  });

  it("reset archives context and recreates runtime folders", () => {
    const gates = path.join(target, "pipeline", "gates");
    fs.writeFileSync(path.join(gates, "stage-01.json"), "{}");

    const result = run("reset");
    assert.equal(result.status, 0);
    assert.deepEqual(fs.readdirSync(gates), []);
    assert.ok(fs.readdirSync(path.join(target, "pipeline", "archive")).length > 0);
  });
});
