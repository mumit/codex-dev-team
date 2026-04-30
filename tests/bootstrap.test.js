const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const BOOTSTRAP = path.join(ROOT, "bootstrap.sh");

describe("bootstrap", () => {
  let target;

  beforeEach(() => {
    target = fs.mkdtempSync(path.join(os.tmpdir(), "codex-bootstrap-"));
  });

  afterEach(() => {
    fs.rmSync(target, { recursive: true, force: true });
  });

  function run() {
    return execFileSync("bash", [BOOTSTRAP, target], {
      cwd: ROOT,
      encoding: "utf8",
    });
  }

  it("installs framework directories", () => {
    run();
    assert.ok(fs.existsSync(path.join(target, ".codex", "skills")));
    assert.ok(fs.existsSync(path.join(target, ".codex", "rules")));
    assert.ok(fs.existsSync(path.join(target, "scripts", "gate-validator.js")));
    assert.ok(fs.existsSync(path.join(target, "schemas", "gate.schema.json")));
    assert.ok(fs.existsSync(path.join(target, "templates", "runbook-template.md")));
  });

  it("preserves an existing AGENTS.md", () => {
    const existing = "# Existing\n";
    fs.writeFileSync(path.join(target, "AGENTS.md"), existing);
    run();
    assert.equal(fs.readFileSync(path.join(target, "AGENTS.md"), "utf8"), existing);
  });

  it("creates pipeline and src structure", () => {
    run();
    assert.ok(fs.existsSync(path.join(target, "pipeline", "context.md")));
    assert.ok(fs.existsSync(path.join(target, "pipeline", "lessons-learned.md")));
    assert.ok(fs.existsSync(path.join(target, "pipeline", "gates")));
    assert.ok(fs.existsSync(path.join(target, "src", "backend")));
    assert.ok(fs.existsSync(path.join(target, "src", "tests")));
  });

  it("creates gitignore entries for runtime artifacts", () => {
    run();
    const gitignore = fs.readFileSync(path.join(target, ".gitignore"), "utf8");

    assert.match(gitignore, /pipeline\/gates\//);
    assert.match(gitignore, /\.codex\/config\.local\.yml/);
  });

  it("adds missing npm command shims when package.json exists", () => {
    fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({
      scripts: {
        test: "node --test",
        status: "custom-status",
      },
    }, null, 2));

    run();
    const pkg = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));

    assert.equal(pkg.scripts.test, "node --test");
    assert.equal(pkg.scripts.status, "custom-status");
    assert.equal(pkg.scripts.next, "node scripts/codex-team.js next");
    assert.equal(pkg.scripts["pipeline:scaffold"], "node scripts/codex-team.js pipeline:scaffold");
  });

  it("does not create package.json for non-Node targets", () => {
    run();

    assert.equal(fs.existsSync(path.join(target, "package.json")), false);
    assert.ok(fs.existsSync(path.join(target, "scripts", "codex-team.js")));
  });

  it("stamps framework version", () => {
    run();
    const source = fs.readFileSync(path.join(ROOT, "VERSION"), "utf8");
    const installed = fs.readFileSync(path.join(target, ".codex", "VERSION"), "utf8");
    assert.equal(installed, source);
  });

  it("is idempotent", () => {
    run();
    run();
    assert.ok(fs.existsSync(path.join(target, ".codex", "skills", "pipeline", "SKILL.md")));
  });
});
