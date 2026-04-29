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

  function run(command, args = []) {
    return spawnSync(process.execPath, [CLI, command, ...args], {
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

  it("status reports gates, artifacts, and audit state", () => {
    run("stage", ["requirements"]);
    run("audit-quick", ["src/backend"]);

    const result = run("status");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Codex Dev Team Status/);
    assert.match(result.stdout, /stage-01\.json/);
    assert.match(result.stdout, /Artifacts/);
    assert.match(result.stdout, /present pipeline\/brief\.md/);
    assert.match(result.stdout, /missing pipeline\/design-spec\.md/);
    assert.match(result.stdout, /Audit/);
    assert.match(result.stdout, /mode=quick scope=src\/backend status=scaffolded/);
  });

  it("reset archives context and recreates runtime folders", () => {
    const gates = path.join(target, "pipeline", "gates");
    const lessons = path.join(target, "pipeline", "lessons-learned.md");
    fs.writeFileSync(path.join(gates, "stage-01.json"), "{}");
    fs.appendFileSync(lessons, "\n### L999 - Keep me\n");

    const result = run("reset");
    assert.equal(result.status, 0);
    assert.deepEqual(fs.readdirSync(gates), []);
    assert.ok(fs.readdirSync(path.join(target, "pipeline", "archive")).length > 0);
    assert.match(fs.readFileSync(lessons, "utf8"), /L999/);
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

  it("audit command scaffolds full audit outputs", () => {
    const result = run("audit", ["src/backend"]);

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(target, "docs", "audit", "00-project-context.md")));
    assert.ok(fs.existsSync(path.join(target, "docs", "audit", "10-roadmap.md")));
    const status = JSON.parse(fs.readFileSync(path.join(target, "docs", "audit", "status.json"), "utf8"));
    assert.equal(status.mode, "full");
    assert.equal(status.scope, "src/backend");
    assert.ok(status.outputs.includes("docs/audit/10-roadmap.md"));
  });

  it("audit-quick command scaffolds orientation outputs only", () => {
    const result = run("audit-quick", ["src/frontend"]);

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(target, "docs", "audit", "00-project-context.md")));
    assert.ok(fs.existsSync(path.join(target, "docs", "audit", "01-architecture.md")));
    assert.equal(fs.existsSync(path.join(target, "docs", "audit", "10-roadmap.md")), false);
    const status = JSON.parse(fs.readFileSync(path.join(target, "docs", "audit", "status.json"), "utf8"));
    assert.equal(status.mode, "quick");
    assert.equal(status.scope, "src/frontend");
  });

  it("health-check command scaffolds audit status for a delta scan", () => {
    const result = run("health-check");

    assert.equal(result.status, 0);
    const status = JSON.parse(fs.readFileSync(path.join(target, "docs", "audit", "status.json"), "utf8"));
    assert.equal(status.mode, "health-check");
    assert.equal(status.scope, "whole project");
  });

  it("pipeline:new prepares workspace and records feature name", () => {
    const result = run("pipeline:new", ["Add search"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Pipeline workspace ready/);
    assert.match(fs.readFileSync(path.join(target, "pipeline", "context.md"), "utf8"), /Add search/);
  });

  it("pipeline command starts a feature and scaffolds requirements", () => {
    const result = run("pipeline", ["Add notifications"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Pipeline workspace ready/);
    assert.match(result.stdout, /created pipeline\/brief\.md/);
    assert.ok(fs.existsSync(path.join(target, "pipeline", "brief.md")));
    assert.match(fs.readFileSync(path.join(target, "pipeline", "context.md"), "utf8"), /Add notifications/);
  });

  it("pipeline-brief command can scaffold requirements by feature name", () => {
    const result = run("pipeline-brief", ["Add reports"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /created pipeline\/brief\.md/);
    assert.match(fs.readFileSync(path.join(target, "pipeline", "context.md"), "utf8"), /Add reports/);
  });

  it("design command starts requirements and design artifacts", () => {
    const result = run("design", ["Add billing"]);

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(target, "pipeline", "brief.md")));
    assert.ok(fs.existsSync(path.join(target, "pipeline", "design-spec.md")));
    assert.ok(fs.existsSync(path.join(target, "pipeline", "gates", "stage-01.json")));
    assert.ok(fs.existsSync(path.join(target, "pipeline", "gates", "stage-02.json")));
  });

  it("pipeline-context prints context and gate status", () => {
    run("stage", ["requirements"]);

    const result = run("pipeline-context");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /# Project Context/);
    assert.match(result.stdout, /Codex Dev Team Status/);
    assert.match(result.stdout, /stage-01\.json/);
  });

  it("pipeline-review scaffolds review artifacts and derives review gates", () => {
    const result = run("pipeline-review");

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(target, "pipeline", "code-review", "by-backend.md")));
    assert.ok(fs.existsSync(path.join(target, "pipeline", "gates", "stage-05-backend.json")));
  });

  it("retrospective scaffolds retrospective artifacts", () => {
    const result = run("retrospective");

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(target, "pipeline", "retrospective.md")));
    assert.ok(fs.existsSync(path.join(target, "pipeline", "gates", "stage-09.json")));
    assert.match(result.stdout, /LESSON:/);
  });

  it("prompt command emits a self-contained stage prompt", () => {
    const result = run("prompt", ["requirements", "Add search"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Role: PM/);
    assert.match(result.stdout, /Stage: stage-01 \(requirements\)/);
    assert.match(result.stdout, /Feature: Add search/);
    assert.match(result.stdout, /Read first:/);
    assert.match(result.stdout, /Allowed writes:/);
    assert.match(result.stdout, /pipeline\/gates\/stage-01\.json/);
    assert.match(result.stdout, /npm run validate/);
  });

  it("prompt command rejects unknown stages", () => {
    const result = run("prompt", ["mystery"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown stage/);
  });

  it("stage requirements scaffolds brief and draft gate", () => {
    const result = run("stage", ["requirements"]);

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(target, "pipeline", "brief.md")));
    const gate = JSON.parse(fs.readFileSync(path.join(target, "pipeline", "gates", "stage-01.json"), "utf8"));
    assert.equal(gate.stage, "stage-01");
    assert.equal(gate.required_sections_complete, false);
  });

  it("stage design scaffolds design spec and draft gate", () => {
    const result = run("stage", ["design"]);

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(target, "pipeline", "design-spec.md")));
    const gate = JSON.parse(fs.readFileSync(path.join(target, "pipeline", "gates", "stage-02.json"), "utf8"));
    assert.equal(gate.arch_approved, false);
  });

  it("stage qa scaffolds test report and draft gate", () => {
    const result = run("stage", ["qa"]);

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(target, "pipeline", "test-report.md")));
    const gate = JSON.parse(fs.readFileSync(path.join(target, "pipeline", "gates", "stage-07.json"), "utf8"));
    assert.equal(gate.all_acceptance_criteria_met, false);
  });

  it("stage command rejects unknown stages", () => {
    const result = run("stage", ["mystery"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown stage/);
  });

  it("lessons command promotes retrospective lesson lines", () => {
    fs.writeFileSync(path.join(target, "pipeline", "retrospective.md"), [
      "# Retrospective",
      "",
      "LESSON: Always map acceptance criteria to tests before sign-off.",
      "",
    ].join("\n"));

    const result = run("lessons", ["promote"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Promoted 1 lesson/);
    assert.match(
      fs.readFileSync(path.join(target, "pipeline", "lessons-learned.md"), "utf8"),
      /Always map acceptance criteria/,
    );
  });
});
