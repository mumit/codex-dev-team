const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

// We test applyCheckpointAutoPass by importing codex-team.js with the cwd
// set to a temp directory so ROOT resolves correctly.
// Because codex-team.js uses process.cwd() at load time via ROOT = process.cwd(),
// we spawn it as a child process and test the exported functions indirectly
// by writing the necessary fixture files.

const { spawnSync } = require("node:child_process");

function runCheckpointCheck(tmp, stageJustPassed) {
  // Small inline script that imports codex-team.js from the test tmp cwd
  const script = `
    process.chdir(${JSON.stringify(tmp)});
    // Patch ROOT inside codex-team.js by re-requiring with the correct cwd
    const ct = require(${JSON.stringify(path.join(ROOT, "scripts", "codex-team.js"))});
    const result = ct.applyCheckpointAutoPass(${JSON.stringify(stageJustPassed)});
    process.stdout.write(result + "\\n");
  `;
  return spawnSync(process.execPath, ["-e", script], {
    cwd: tmp,
    encoding: "utf8",
  });
}

function writeConfig(dir, checkpoints = {}) {
  const codexDir = path.join(dir, ".codex");
  fs.mkdirSync(codexDir, { recursive: true });

  const lines = ["checkpoints:"];
  for (const [label, condition] of Object.entries(checkpoints)) {
    lines.push(`  ${label}:`);
    lines.push(`    auto_pass_when: ${condition === null ? "null" : condition}`);
  }

  fs.writeFileSync(path.join(codexDir, "config.yml"), lines.join("\n") + "\n");
}

function writeGate(dir, stageName, gate) {
  const gatesDir = path.join(dir, "pipeline", "gates");
  fs.mkdirSync(gatesDir, { recursive: true });
  fs.writeFileSync(path.join(gatesDir, `${stageName}.json`), JSON.stringify(gate) + "\n");
}

function writeContext(dir, content) {
  const pipelineDir = path.join(dir, "pipeline");
  fs.mkdirSync(pipelineDir, { recursive: true });
  fs.writeFileSync(path.join(pipelineDir, "context.md"), content);
}

describe("checkpoint auto-pass", () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-checkpoint-"));
    // Create minimal pipeline workspace
    fs.mkdirSync(path.join(tmp, "pipeline", "gates"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "pipeline", "context.md"), "# Context\n");
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  describe("null / absent conditions (default — always wait)", () => {
    it("returns 'waiting' when auto_pass_when is null for checkpoint a", () => {
      writeConfig(tmp, { a: null, b: null, c: null });
      writeGate(tmp, "stage-01", { status: "PASS", warnings: [], all_acceptance_criteria_met: true });
      const result = runCheckpointCheck(tmp, "requirements");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /waiting/);
    });

    it("returns 'waiting' when no config exists", () => {
      writeGate(tmp, "stage-01", { status: "PASS", warnings: [] });
      const result = runCheckpointCheck(tmp, "requirements");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /waiting/);
    });
  });

  describe("no_warnings condition", () => {
    it("auto-passes checkpoint a when warnings is empty", () => {
      writeConfig(tmp, { a: "no_warnings" });
      writeGate(tmp, "stage-01", { status: "PASS", warnings: [] });
      const result = runCheckpointCheck(tmp, "requirements");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /auto-passed/);

      const context = fs.readFileSync(path.join(tmp, "pipeline", "context.md"), "utf8");
      assert.match(context, /CHECKPOINT-AUTO-PASS: a \(no_warnings\)/);
    });

    it("does NOT auto-pass when warnings is non-empty", () => {
      writeConfig(tmp, { a: "no_warnings" });
      writeGate(tmp, "stage-01", { status: "PASS", warnings: ["Redis not configured"] });
      const result = runCheckpointCheck(tmp, "requirements");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /waiting/);
    });

    it("auto-passes checkpoint b when warnings is empty", () => {
      writeConfig(tmp, { b: "no_warnings" });
      writeGate(tmp, "stage-02", { status: "PASS", warnings: [] });
      const result = runCheckpointCheck(tmp, "design");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /auto-passed/);

      const context = fs.readFileSync(path.join(tmp, "pipeline", "context.md"), "utf8");
      assert.match(context, /CHECKPOINT-AUTO-PASS: b \(no_warnings\)/);
    });
  });

  describe("all_criteria_passed condition (checkpoint c only)", () => {
    it("auto-passes checkpoint c when all_acceptance_criteria_met and 1:1 mapping", () => {
      writeConfig(tmp, { c: "all_criteria_passed" });
      writeGate(tmp, "stage-07", {
        status: "PASS",
        warnings: [],
        all_acceptance_criteria_met: true,
        criterion_to_test_mapping_is_one_to_one: true,
      });
      const result = runCheckpointCheck(tmp, "qa");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /auto-passed/);

      const context = fs.readFileSync(path.join(tmp, "pipeline", "context.md"), "utf8");
      assert.match(context, /CHECKPOINT-AUTO-PASS: c \(all_criteria_passed\)/);
    });

    it("does NOT auto-pass when all_acceptance_criteria_met is false", () => {
      writeConfig(tmp, { c: "all_criteria_passed" });
      writeGate(tmp, "stage-07", {
        status: "PASS",
        warnings: [],
        all_acceptance_criteria_met: false,
        criterion_to_test_mapping_is_one_to_one: true,
      });
      const result = runCheckpointCheck(tmp, "qa");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /waiting/);
    });

    it("does NOT auto-pass when criterion_to_test_mapping_is_one_to_one is false", () => {
      writeConfig(tmp, { c: "all_criteria_passed" });
      writeGate(tmp, "stage-07", {
        status: "PASS",
        warnings: [],
        all_acceptance_criteria_met: true,
        criterion_to_test_mapping_is_one_to_one: false,
      });
      const result = runCheckpointCheck(tmp, "qa");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /waiting/);
    });
  });

  describe("non-checkpoint stages", () => {
    it("returns 'not-a-checkpoint' for build stage", () => {
      const result = runCheckpointCheck(tmp, "build");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /not-a-checkpoint/);
    });

    it("returns 'not-a-checkpoint' for deploy stage", () => {
      const result = runCheckpointCheck(tmp, "deploy");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /not-a-checkpoint/);
    });
  });

  describe("security stoplist override", () => {
    it("suppresses auto-pass when context.md mentions auth", () => {
      writeConfig(tmp, { a: "no_warnings" });
      writeGate(tmp, "stage-01", { status: "PASS", warnings: [] });
      writeContext(tmp, "# Context\n\nTRACK: full\nThis touches authentication and session handling.\n");

      const result = runCheckpointCheck(tmp, "requirements");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /suppressed/);
    });

    it("suppresses auto-pass when context.md mentions cryptography", () => {
      writeConfig(tmp, { b: "no_warnings" });
      writeGate(tmp, "stage-02", { status: "PASS", warnings: [] });
      writeContext(tmp, "# Context\n\nThis change modifies cryptography key management.\n");

      const result = runCheckpointCheck(tmp, "design");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /suppressed/);
    });

    it("suppresses checkpoint c auto-pass when context.md mentions pii", () => {
      writeConfig(tmp, { c: "all_criteria_passed" });
      writeGate(tmp, "stage-07", {
        status: "PASS",
        warnings: [],
        all_acceptance_criteria_met: true,
        criterion_to_test_mapping_is_one_to_one: true,
      });
      writeContext(tmp, "# Context\n\nThis feature handles pii and payments.\n");

      const result = runCheckpointCheck(tmp, "qa");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /suppressed/);
    });

    it("does NOT suppress when context.md has no stoplist triggers", () => {
      writeConfig(tmp, { a: "no_warnings" });
      writeGate(tmp, "stage-01", { status: "PASS", warnings: [] });
      writeContext(tmp, "# Context\n\nAdded password reset feature via email.\n");

      const result = runCheckpointCheck(tmp, "requirements");
      assert.equal(result.status, 0);
      assert.match(result.stdout, /auto-passed/);
    });
  });
});
