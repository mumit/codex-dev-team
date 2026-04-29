const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT = path.resolve(__dirname, "..", "scripts", "consistency.js");

describe("pipeline consistency", () => {
  let target;

  beforeEach(() => {
    target = fs.mkdtempSync(path.join(os.tmpdir(), "codex-consistency-"));
    fs.mkdirSync(path.join(target, "pipeline", "gates"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(target, { recursive: true, force: true });
  });

  function run() {
    return spawnSync(process.execPath, [SCRIPT], {
      cwd: target,
      encoding: "utf8",
    });
  }

  it("passes when no runtime pipeline exists yet", () => {
    const result = run();

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Pipeline consistency OK/);
  });

  it("fails when an artifact is missing its gate", () => {
    fs.writeFileSync(path.join(target, "pipeline", "brief.md"), "# Brief\n");

    const result = run();

    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing gate for pipeline\/brief\.md/);
  });

  it("fails when a gate filename does not match its stage", () => {
    fs.writeFileSync(path.join(target, "pipeline", "brief.md"), "# Brief\n");
    fs.writeFileSync(path.join(target, "pipeline", "gates", "stage-01.json"), JSON.stringify({
      stage: "stage-02",
    }));

    const result = run();

    assert.equal(result.status, 1);
    assert.match(result.stderr, /gate filename stage-01\.json does not match stage stage-02/);
  });
});
