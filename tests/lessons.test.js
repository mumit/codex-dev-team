const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const SCRIPT = path.resolve(__dirname, "..", "scripts", "lessons.js");

describe("lessons helper", () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-lessons-"));
    fs.mkdirSync(path.join(tmp, "pipeline"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function run(...args) {
    return execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: tmp,
      encoding: "utf8",
    });
  }

  it("show creates a seed lessons file when missing", () => {
    const output = run("show");
    assert.match(output, /# Lessons Learned/);
    assert.ok(fs.existsSync(path.join(tmp, "pipeline", "lessons-learned.md")));
  });

  it("promotes unique LESSON lines", () => {
    fs.writeFileSync(path.join(tmp, "pipeline", "retrospective.md"), [
      "LESSON: Prefer scoped gates for one-area changes.",
      "LESSON: Prefer scoped gates for one-area changes.",
      "",
    ].join("\n"));

    const output = run("promote");
    assert.match(output, /Promoted 1 lesson/);
    const lessons = fs.readFileSync(path.join(tmp, "pipeline", "lessons-learned.md"), "utf8");
    assert.match(lessons, /L001/);
    assert.match(lessons, /Prefer scoped gates/);
  });
});
