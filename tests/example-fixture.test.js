const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const EXAMPLE = path.join(ROOT, "examples", "tiny-app");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

describe("tiny app example", () => {
  it("runs tests before and after framework bootstrap", () => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), "codex-tiny-app-"));
    try {
      copyDir(EXAMPLE, target);

      execFileSync("npm", ["test"], {
        cwd: target,
        encoding: "utf8",
      });

      execFileSync("bash", [path.join(ROOT, "bootstrap.sh"), target], {
        cwd: ROOT,
        encoding: "utf8",
      });

      const scaffold = spawnSync(process.execPath, [
        path.join(target, "scripts", "codex-team.js"),
        "pipeline:scaffold",
        "Add health endpoint",
      ], {
        cwd: target,
        encoding: "utf8",
      });

      assert.equal(scaffold.status, 0, scaffold.stderr);
      assert.ok(fs.existsSync(path.join(target, "pipeline", "brief.md")));
      assert.ok(fs.existsSync(path.join(target, "pipeline", "gates", "stage-09.json")));

      execFileSync("npm", ["test"], {
        cwd: target,
        encoding: "utf8",
      });
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
});
