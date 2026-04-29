const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

describe("dogfood install", () => {
  let target;

  beforeEach(() => {
    target = fs.mkdtempSync(path.join(os.tmpdir(), "codex-dogfood-"));
    fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({
      scripts: {
        test: "node --test",
      },
    }, null, 2));
  });

  afterEach(() => {
    fs.rmSync(target, { recursive: true, force: true });
  });

  it("installs into a tiny app and validates a real requirements gate", () => {
    execFileSync("bash", [path.join(ROOT, "bootstrap.sh"), target], {
      cwd: ROOT,
      encoding: "utf8",
    });

    const gate = {
      stage: "stage-01",
      status: "PASS",
      agent: "pm",
      track: "full",
      timestamp: "2026-04-29T12:00:00Z",
      blockers: [],
      warnings: [],
      acceptance_criteria_count: 1,
      out_of_scope_items: [],
      required_sections_complete: true,
    };

    fs.writeFileSync(
      path.join(target, "pipeline", "gates", "stage-01.json"),
      JSON.stringify(gate, null, 2),
    );

    const output = execFileSync(process.execPath, [path.join(target, "scripts", "gate-validator.js")], {
      cwd: target,
      encoding: "utf8",
    });
    assert.match(output, /PASS - stage-01/);
  });
});
