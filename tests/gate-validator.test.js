const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const VALIDATOR = path.resolve(__dirname, "..", "scripts", "gate-validator.js");

function run(cwd, args = []) {
  try {
    const stdout = execFileSync(process.execPath, [VALIDATOR, ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      status: err.status,
      stdout: err.stdout || "",
      stderr: err.stderr || "",
    };
  }
}

function gate(overrides = {}) {
  return {
    stage: "stage-01",
    status: "PASS",
    agent: "pm",
    track: "full",
    timestamp: "2026-04-29T12:00:00Z",
    blockers: [],
    warnings: [],
    ...overrides,
  };
}

function requirementsGate(overrides = {}) {
  return gate({
    acceptance_criteria_count: 2,
    out_of_scope_items: [],
    required_sections_complete: true,
    ...overrides,
  });
}

function reviewGate(overrides = {}) {
  return gate({
    stage: "stage-06-backend",
    agent: "codex-team",
    area: "backend",
    review_shape: "matrix",
    required_approvals: 2,
    approvals: ["frontend", "platform"],
    changes_requested: [],
    escalated_to_principal: false,
    ...overrides,
  });
}

function qaGate(overrides = {}) {
  return gate({
    stage: "stage-07",
    agent: "qa",
    all_acceptance_criteria_met: true,
    tests_total: 1,
    tests_passed: 1,
    tests_failed: 0,
    failing_tests: [],
    criterion_to_test_mapping_is_one_to_one: true,
    ...overrides,
  });
}

describe("gate-validator", () => {
  let tmp;
  let gates;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-gate-"));
    gates = path.join(tmp, "pipeline", "gates");
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("exits 0 when no gates exist", () => {
    const result = run(tmp);
    assert.equal(result.status, 0);
  });

  it("passes a valid PASS gate", () => {
    fs.mkdirSync(gates, { recursive: true });
    fs.writeFileSync(path.join(gates, "stage-01.json"), JSON.stringify(requirementsGate()));

    const result = run(tmp);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /PASS/);
  });

  it("fails malformed gates", () => {
    fs.mkdirSync(gates, { recursive: true });
    fs.writeFileSync(path.join(gates, "stage-01.json"), JSON.stringify({ status: "PASS" }));

    const result = run(tmp);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing required field/);
  });

  it("returns 2 for FAIL gates", () => {
    fs.mkdirSync(gates, { recursive: true });
    fs.writeFileSync(path.join(gates, "stage-99.json"), JSON.stringify(gate({
      stage: "stage-99",
      status: "FAIL",
      agent: "qa",
      blockers: ["test failed"],
    })));

    const result = run(tmp);
    assert.equal(result.status, 2);
    assert.match(result.stdout, /test failed/);
  });

  it("requires retry delta", () => {
    fs.mkdirSync(gates, { recursive: true });
    fs.writeFileSync(path.join(gates, "stage-99.json"), JSON.stringify(gate({
      stage: "stage-99",
      status: "FAIL",
      retry_number: 1,
      this_attempt_differs_by: "",
    })));

    const result = run(tmp);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /retry gates require/);
  });

  it("applies stage-specific schema validation", () => {
    fs.mkdirSync(gates, { recursive: true });
    fs.writeFileSync(path.join(gates, "stage-01.json"), JSON.stringify(gate()));

    const result = run(tmp);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /stage-01\.schema\.json: missing required field: acceptance_criteria_count/);
  });

  it("sanitizes and truncates log output", () => {
    fs.mkdirSync(gates, { recursive: true });
    fs.writeFileSync(path.join(gates, "stage-99.json"), JSON.stringify(gate({
      stage: "stage-99",
      status: "FAIL",
      blockers: [`\u001b[31m${"x".repeat(700)}\u001b[0m\u0007`],
    })));

    const result = run(tmp);
    assert.equal(result.status, 2);
    assert.equal(result.stdout.includes("\u001b"), false);
    assert.match(result.stdout, /\[truncated\]/);
  });

  it("validates every gate when requested", () => {
    fs.mkdirSync(gates, { recursive: true });
    fs.writeFileSync(path.join(gates, "stage-01.json"), JSON.stringify({ status: "PASS" }));
    fs.writeFileSync(path.join(gates, "stage-99.json"), JSON.stringify(gate({
      stage: "stage-99",
      status: "PASS",
    })));

    const latestOnly = run(tmp);
    assert.equal(latestOnly.status, 0);

    const all = run(tmp, ["--all"]);
    assert.equal(all.status, 1);
    assert.match(all.stderr, /invalid gate stage-01\.json/);
  });

  it("returns 2 when all gates are valid but at least one gate failed", () => {
    fs.mkdirSync(gates, { recursive: true });
    fs.writeFileSync(path.join(gates, "stage-01.json"), JSON.stringify(requirementsGate()));
    fs.writeFileSync(path.join(gates, "stage-99.json"), JSON.stringify(gate({
      stage: "stage-99",
      status: "FAIL",
      blockers: ["manual follow-up needed"],
    })));

    const result = run(tmp, ["--all"]);
    assert.equal(result.status, 2);
    assert.match(result.stdout, /manual follow-up needed/);
  });

  it("enforces scoped review gates for quick and dependency tracks", () => {
    fs.mkdirSync(gates, { recursive: true });
    fs.writeFileSync(path.join(gates, "stage-06-backend.json"), JSON.stringify(reviewGate({
      track: "quick",
      required_approvals: 2,
    })));

    const result = run(tmp, ["--all"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /quick review gates must require exactly 1 approval/);
  });

  it("enforces regression checks for regression-only tracks on PASS", () => {
    fs.mkdirSync(gates, { recursive: true });
    fs.writeFileSync(path.join(gates, "stage-07.json"), JSON.stringify(qaGate({
      track: "dep-update",
    })));

    const result = run(tmp, ["--all"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /dep-update Stage 7 PASS gates require regression_check=PASS/);
  });

  it("rejects stages skipped by nano track", () => {
    fs.mkdirSync(gates, { recursive: true });
    fs.writeFileSync(path.join(gates, "stage-01.json"), JSON.stringify(requirementsGate({
      track: "nano",
    })));

    const result = run(tmp, ["--all"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /nano track must not write stage-01/);
  });

  it("requires hotfix pre-review PASS gates to record the skipped automated check", () => {
    fs.mkdirSync(gates, { recursive: true });
    fs.writeFileSync(path.join(gates, "stage-05.json"), JSON.stringify(gate({
      stage: "stage-05",
      agent: "platform",
      track: "hotfix",
      lint_passed: false,
      tests_passed: false,
      dependency_review_passed: false,
      security_review_required: false,
    })));

    const result = run(tmp, ["--all"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /hotfix Stage 5 PASS gates require stage_4_5a_skipped=true/);
  });
});
