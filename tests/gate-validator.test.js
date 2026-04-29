const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const VALIDATOR = path.resolve(__dirname, "..", "scripts", "gate-validator.js");

function run(cwd) {
  try {
    const stdout = execFileSync(process.execPath, [VALIDATOR], {
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
    fs.writeFileSync(path.join(gates, "stage-06.json"), JSON.stringify(gate({
      stage: "stage-06",
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
    fs.writeFileSync(path.join(gates, "stage-06.json"), JSON.stringify(gate({
      stage: "stage-06",
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
    fs.writeFileSync(path.join(gates, "stage-06.json"), JSON.stringify(gate({
      stage: "stage-06",
      status: "FAIL",
      blockers: [`\u001b[31m${"x".repeat(700)}\u001b[0m\u0007`],
    })));

    const result = run(tmp);
    assert.equal(result.status, 2);
    assert.equal(result.stdout.includes("\u001b"), false);
    assert.match(result.stdout, /\[truncated\]/);
  });
});
