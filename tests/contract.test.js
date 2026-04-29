const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("framework contracts", () => {
  it("package, lockfile, config, and VERSION agree", () => {
    const version = read("VERSION").trim();
    const pkg = JSON.parse(read("package.json"));
    const lock = JSON.parse(read("package-lock.json"));
    const config = read(".codex/config.yml");

    assert.equal(pkg.version, version);
    assert.equal(lock.version, version);
    assert.equal(lock.packages[""].version, version);
    assert.match(config, new RegExp(`version: "${version}"`));
  });

  it("documented gate required fields match schema required fields", () => {
    const schema = JSON.parse(read("schemas/gate.schema.json"));
    const gatesDoc = read(".codex/rules/gates.md");
    const match = gatesDoc.match(/## Required Fields[\s\S]*?```json\n([\s\S]*?)\n```/);
    assert.ok(match, "gates.md should include a required-fields JSON example");
    const example = JSON.parse(match[1]);

    for (const field of schema.required) {
      assert.ok(field in example, `missing ${field} from gates.md example`);
    }
  });

  it("stage schemas are present for high-value stages", () => {
    for (const stage of ["stage-01", "stage-02", "stage-05", "stage-07", "stage-08", "stage-09"]) {
      const fullPath = path.join(ROOT, "schemas", `${stage}.schema.json`);
      assert.ok(fs.existsSync(fullPath), `${stage} schema should exist`);
      const schema = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      assert.equal(schema.type, "object");
      assert.ok(Array.isArray(schema.required));
    }
  });

  it("core skills exist and have frontmatter", () => {
    for (const name of ["pipeline", "implement", "pre-pr-review", "audit", "quick", "hotfix"]) {
      const skill = read(`.codex/skills/${name}/SKILL.md`);
      assert.ok(skill.startsWith("---\n"), `${name} skill should start with frontmatter`);
      assert.match(skill, new RegExp(`name: ${name}`));
      assert.match(skill, /description:/);
    }
  });
});
