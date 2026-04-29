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

  it("runbook command checks deploy runbooks", () => {
    fs.writeFileSync(path.join(target, "pipeline", "runbook.md"), [
      "# Runbook",
      "",
      "## Rollback",
      "Revert.",
      "",
      "## Health signals",
      "Smoke.",
      "",
    ].join("\n"));

    const result = run("runbook");
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Runbook OK/);
  });

  it("pipeline:new prepares workspace and records feature name", () => {
    const result = spawnSync(process.execPath, [CLI, "pipeline:new", "Add search"], {
      cwd: target,
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Pipeline workspace ready/);
    assert.match(fs.readFileSync(path.join(target, "pipeline", "context.md"), "utf8"), /Add search/);
  });

  it("stage requirements scaffolds brief and draft gate", () => {
    const result = spawnSync(process.execPath, [CLI, "stage", "requirements"], {
      cwd: target,
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(target, "pipeline", "brief.md")));
    const gate = JSON.parse(fs.readFileSync(path.join(target, "pipeline", "gates", "stage-01.json"), "utf8"));
    assert.equal(gate.stage, "stage-01");
    assert.equal(gate.required_sections_complete, false);
  });

  it("stage design scaffolds design spec and draft gate", () => {
    const result = spawnSync(process.execPath, [CLI, "stage", "design"], {
      cwd: target,
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(target, "pipeline", "design-spec.md")));
    const gate = JSON.parse(fs.readFileSync(path.join(target, "pipeline", "gates", "stage-02.json"), "utf8"));
    assert.equal(gate.arch_approved, false);
  });

  it("stage qa scaffolds test report and draft gate", () => {
    const result = spawnSync(process.execPath, [CLI, "stage", "qa"], {
      cwd: target,
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(target, "pipeline", "test-report.md")));
    const gate = JSON.parse(fs.readFileSync(path.join(target, "pipeline", "gates", "stage-07.json"), "utf8"));
    assert.equal(gate.all_acceptance_criteria_met, false);
  });

  it("stage command rejects unknown stages", () => {
    const result = spawnSync(process.execPath, [CLI, "stage", "mystery"], {
      cwd: target,
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown stage/);
  });
});
