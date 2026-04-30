const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "release.js");

describe("release helper", () => {
  let target;

  beforeEach(() => {
    target = fs.mkdtempSync(path.join(os.tmpdir(), "codex-release-"));
    fs.mkdirSync(path.join(target, ".codex"), { recursive: true });
    fs.mkdirSync(path.join(target, "examples", "tiny-app"), { recursive: true });
    fs.mkdirSync(path.join(target, ".github", "workflows"), { recursive: true });
    fs.mkdirSync(path.join(target, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(target, "VERSION"), "1.2.3\n");
    fs.writeFileSync(path.join(target, "README.md"), "# Test\n");
    fs.writeFileSync(path.join(target, "AGENTS.md"), "# Agents\n");
    fs.writeFileSync(path.join(target, ".codex", "config.yml"), "version: \"1.2.3\"\n");
    fs.writeFileSync(path.join(target, ".github", "workflows", "test.yml"), "name: test\n");
    fs.writeFileSync(path.join(target, "scripts", "codex-team.js"), "");
    fs.writeFileSync(path.join(target, "scripts", "gate-validator.js"), "");
    fs.writeFileSync(path.join(target, "examples", "tiny-app", "package.json"), "{}");
    fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({
      version: "1.2.3",
      scripts: {
        test: "node --test",
        help: "node scripts/codex-team.js help",
        lint: "node scripts/lint-syntax.js",
        validate: "node scripts/codex-team.js validate",
        doctor: "node scripts/codex-team.js doctor",
        status: "node scripts/codex-team.js status",
        next: "node scripts/codex-team.js next",
        roadmap: "node scripts/codex-team.js roadmap",
        quick: "node scripts/codex-team.js quick",
        nano: "node scripts/codex-team.js nano",
        "config-only": "node scripts/codex-team.js config-only",
        "dep-update": "node scripts/codex-team.js dep-update",
        hotfix: "node scripts/codex-team.js hotfix",
        "pipeline:scaffold": "node scripts/codex-team.js pipeline:scaffold",
        "ask-pm": "node scripts/codex-team.js ask-pm",
        "principal-ruling": "node scripts/codex-team.js principal-ruling",
        adr: "node scripts/codex-team.js adr",
        resume: "node scripts/codex-team.js resume",
        "gate:check:all": "node scripts/gate-validator.js --all",
        summary: "node scripts/codex-team.js summary",
        "pr:pack": "node scripts/pr-pack.js",
        autofold: "node scripts/codex-team.js autofold",
        "parity:check": "node scripts/parity-check.js",
      },
    }, null, 2));
    fs.writeFileSync(path.join(target, "package-lock.json"), JSON.stringify({
      version: "1.2.3",
      packages: {
        "": {
          version: "1.2.3",
        },
      },
    }, null, 2));
  });

  afterEach(() => {
    fs.rmSync(target, { recursive: true, force: true });
  });

  function run(args) {
    return spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd: target,
      encoding: "utf8",
    });
  }

  it("passes when release metadata is consistent", () => {
    const result = run(["check"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Release check OK for v1\.2\.3/);
  });

  it("fails when versions drift", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
    pkg.version = "9.9.9";
    fs.writeFileSync(path.join(target, "package.json"), JSON.stringify(pkg, null, 2));

    const result = run(["check"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /package\.json version 9\.9\.9/);
  });

  it("fails when required CLI scripts are missing", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
    delete pkg.scripts.next;
    fs.writeFileSync(path.join(target, "package.json"), JSON.stringify(pkg, null, 2));

    const result = run(["check"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing npm script: next/);
  });

  it("writes release notes for the current version", () => {
    const result = run(["notes"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /wrote docs\/release-notes\/v1\.2\.3\.md/);
    assert.match(
      fs.readFileSync(path.join(target, "docs", "release-notes", "v1.2.3.md"), "utf8"),
      /# Release v1\.2\.3/,
    );
  });
});
