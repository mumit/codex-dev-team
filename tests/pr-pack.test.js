const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "pr-pack.js");

describe("PR pack helper", () => {
  let target;

  beforeEach(() => {
    target = fs.mkdtempSync(path.join(os.tmpdir(), "codex-pr-pack-"));
    execFileSync("git", ["init"], { cwd: target, encoding: "utf8" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: target, encoding: "utf8" });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: target, encoding: "utf8" });
    fs.writeFileSync(path.join(target, "one.txt"), "one\n");
    execFileSync("git", ["add", "one.txt"], { cwd: target, encoding: "utf8" });
    execFileSync("git", ["commit", "-m", "feat: add one"], { cwd: target, encoding: "utf8" });
    fs.writeFileSync(path.join(target, "two.txt"), "two\n");
    execFileSync("git", ["add", "two.txt"], { cwd: target, encoding: "utf8" });
    execFileSync("git", ["commit", "-m", "test: add two"], { cwd: target, encoding: "utf8" });
  });

  afterEach(() => {
    fs.rmSync(target, { recursive: true, force: true });
  });

  it("writes local PR stack notes from git history", () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: target,
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /wrote docs\/pr\/stack\.md/);
    const notes = fs.readFileSync(path.join(target, "docs", "pr", "stack.md"), "utf8");
    assert.match(notes, /# PR Stack Notes/);
    assert.match(notes, /feat: add one/);
    assert.match(notes, /test: add two/);
    assert.match(notes, /one\.txt/);
    assert.match(notes, /two\.txt/);
    assert.match(notes, /npm run release:check/);
  });
});
