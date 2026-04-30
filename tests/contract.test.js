const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PACKAGE_SCRIPTS } = require("../scripts/bootstrap");
const { STAGES, TRACKS, draftGateObject, orderedStageNames } = require("../scripts/codex-team");

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
    for (const stage of [
      "stage-01",
      "stage-02",
      "stage-03",
      "stage-04",
      "stage-05",
      "stage-06",
      "stage-07",
      "stage-08",
      "stage-09",
    ]) {
      const fullPath = path.join(ROOT, "schemas", `${stage}.schema.json`);
      assert.ok(fs.existsSync(fullPath), `${stage} schema should exist`);
      const schema = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      assert.equal(schema.type, "object");
      assert.ok(Array.isArray(schema.required));
    }
  });

  it("stage configuration has matching templates and schemas", () => {
    assert.deepEqual(orderedStageNames(), [
      "requirements",
      "design",
      "clarification",
      "build",
      "pre-review",
      "peer-review",
      "qa",
      "deploy",
      "retrospective",
    ]);

    for (const name of orderedStageNames()) {
      const config = STAGES[name];
      assert.ok(config, `${name} should have a stage config`);
      assert.match(config.artifact, /^pipeline\//, `${name} artifact should live under pipeline/`);
      assert.match(config.template, /-template\.md$/, `${name} should use a template`);
      assert.ok(fs.existsSync(path.join(ROOT, "templates", config.template)), `${name} template should exist`);

      const schemaStage = config.stage.startsWith("stage-06") ? "stage-06" : config.stage;
      assert.ok(fs.existsSync(path.join(ROOT, "schemas", `${schemaStage}.schema.json`)), `${name} schema should exist`);
    }
  });

  it("configured tracks match gate schema enum", () => {
    const schema = JSON.parse(read("schemas/gate.schema.json"));
    assert.deepEqual(TRACKS, schema.properties.track.enum);
  });

  it("stage draft gates include required base and stage fields", () => {
    const baseSchema = JSON.parse(read("schemas/gate.schema.json"));

    for (const name of orderedStageNames()) {
      const config = STAGES[name];
      const gate = draftGateObject(config, "2026-01-01T00:00:00.000Z");
      const stageSchema = JSON.parse(read(`schemas/${config.stage.startsWith("stage-06") ? "stage-06" : config.stage}.schema.json`));

      for (const field of baseSchema.required) {
        assert.ok(field in gate, `${name} draft gate should include base field ${field}`);
      }

      for (const field of stageSchema.required) {
        assert.ok(field in gate, `${name} draft gate should include stage field ${field}`);
      }
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

  it("planning skills reference lessons learned", () => {
    for (const skill of ["pipeline", "implement", "audit"]) {
      const body = read(`.codex/skills/${skill}/SKILL.md`);
      assert.match(body, /lessons-learned\.md/, `${skill} should read lessons`);
    }
  });

  it("role prompt briefs exist for all framework roles", () => {
    for (const role of ["backend", "frontend", "platform", "pm", "principal", "qa", "reviewer", "security"]) {
      const body = read(`.codex/prompts/roles/${role}.md`);
      assert.match(body, new RegExp(`# .*Role Brief`));
      assert.match(body, /## Read First/);
      assert.match(body, /## Writes/);
      assert.match(body, /## Handoff/);
    }
  });

  it("CI runs framework release checks", () => {
    const workflow = read(".github/workflows/test.yml");
    for (const command of ["npm run lint", "npm test", "npm run validate", "npm run doctor", "npm run release:check"]) {
      assert.match(workflow, new RegExp(command.replaceAll(" ", "\\s+")));
    }
  });

  it("AGENTS command shims document core npm workflows", () => {
    const agents = read("AGENTS.md");
    for (const command of [
      "npm run pipeline",
      "npm run pipeline:scaffold",
      "npm run status",
      "npm run next",
      "npm run roadmap",
      "npm run help",
      "npm run audit",
      "npm run health-check",
    ]) {
      assert.match(agents, new RegExp(command.replaceAll(" ", "\\s+")));
    }
  });

  it("documents non-Node bootstrap behavior", () => {
    const readme = read("README.md");
    const agents = read("AGENTS.md");

    assert.match(readme, /no `package\.json` is created/);
    assert.match(readme, /node scripts\/codex-team\.js help/);
    assert.match(agents, /Bootstrap only installs npm shims when the target already has `package\.json`/);
    assert.match(agents, /node scripts\/codex-team\.js/);
  });

  it("bootstrap package shims stay aligned with root npm scripts", () => {
    const pkg = JSON.parse(read("package.json"));
    for (const script of Object.keys(PACKAGE_SCRIPTS)) {
      assert.ok(pkg.scripts[script], `root package should include ${script}`);
    }
  });
});
