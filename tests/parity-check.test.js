const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const {
  main,
  checkCommands,
  checkRules,
  checkSkills,
  checkGapsAndPartials,
  checkRolePromptLines,
  checkConfigKeys,
  checkStoplistContent,
  checkStageDivergenceDoc,
  checkAuditPhases,
} = require(path.join(ROOT, "scripts", "parity-check.js"));

// ---------------------------------------------------------------------------
// Case 1: main() returns 0 on the actual repo
// ---------------------------------------------------------------------------

describe("parity-check — full repo", () => {
  it("main() returns 0 on the current repo", () => {
    const result = main(ROOT);
    assert.equal(result, 0, "parity check should pass on the live repo");
  });
});

// ---------------------------------------------------------------------------
// Helper: scaffold a minimal tmp directory that passes all checks
// ---------------------------------------------------------------------------

function scaffoldRepo(tmpDir) {
  // parity doc with all required commands, stage divergence heading, no gaps
  const parityDir = path.join(tmpDir, "docs", "parity");
  fs.mkdirSync(parityDir, { recursive: true });
  const commandRows = [
    "/adr", "/ask-pm", "/audit", "/audit-quick", "/config-only",
    "/dep-update", "/design", "/health-check", "/hotfix", "/nano",
    "/pipeline", "/pipeline-brief", "/pipeline-context", "/pipeline-review",
    "/principal-ruling", "/quick", "/reset", "/resume", "/retrospective",
    "/review", "/roadmap", "/stage", "/status",
  ].map((c) => `| \`${c}\` | equivalent | Ported |`).join("\n");
  fs.writeFileSync(path.join(parityDir, "claude-dev-team-parity.md"), [
    "# Parity",
    "## Stage Numbering Divergence",
    "Some text about divergence.",
    "## Commands",
    commandRows,
  ].join("\n"));

  // rules
  const rulesDir = path.join(tmpDir, ".codex", "rules");
  fs.mkdirSync(rulesDir, { recursive: true });
  for (const rule of [
    "coding-principles", "compaction", "escalation",
    "gates", "orchestrator", "pipeline", "retrospective",
  ]) {
    fs.writeFileSync(path.join(rulesDir, `${rule}.md`), `# ${rule}\n\nSafety stoplist content here.\nAuthentication checks.\nCryptography rules.\nPII handling.\n`);
  }

  // skills
  for (const skill of [
    "api-conventions", "code-conventions", "implement",
    "pre-pr-review", "review-rubric", "security-checklist",
  ]) {
    const skillDir = path.join(tmpDir, ".codex", "skills", skill);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), `# ${skill}\n`);
  }

  // role prompts (>= 60 lines each)
  const rolesDir = path.join(tmpDir, ".codex", "prompts", "roles");
  fs.mkdirSync(rolesDir, { recursive: true });
  const longContent = ["# Role\n", ...Array(65).fill("Some behavioral content.\n")].join("");
  for (const role of ["pm", "principal", "backend", "frontend", "platform", "qa", "security", "reviewer"]) {
    fs.writeFileSync(path.join(rolesDir, `${role}.md`), longContent);
  }

  // config.yml with all required top-level keys
  const codexDir = path.join(tmpDir, ".codex");
  fs.mkdirSync(codexDir, { recursive: true });
  fs.writeFileSync(path.join(codexDir, "config.yml"), [
    "framework:",
    "  version: \"1.0.0\"",
    "execution:",
    "  default_profile: local",
    "pipeline:",
    "  default_track: full",
    "security:",
    "  trigger_paths: []",
    "deploy:",
    "  adapter: docker-compose",
    "budget:",
    "  enabled: false",
    "checkpoints:",
    "  a:",
    "    auto_pass_when: null",
  ].join("\n"));

  // pipeline.md with stoplist content
  fs.writeFileSync(path.join(rulesDir, "pipeline.md"), [
    "# Pipeline",
    "## Safety stoplist",
    "- Authentication, authorization, or session handling",
    "- Cryptography, key management, or secrets rotation",
    "- PII, payments, or regulated-data handling",
    "- Schema migrations",
    "",
    "## Tracks",
    "| full | All features |",
  ].join("\n"));

  // audit-phases reference (>= 100 lines)
  const refsDir = path.join(tmpDir, ".codex", "references");
  fs.mkdirSync(refsDir, { recursive: true });
  const phaseContent = ["# Audit Phase Definitions\n", ...Array(105).fill("Phase content.\n")].join("");
  fs.writeFileSync(path.join(refsDir, "audit-phases.md"), phaseContent);
}

// ---------------------------------------------------------------------------
// Case 2: missing stoplist string makes main() return non-zero
// ---------------------------------------------------------------------------

describe("parity-check — stoplist validation", () => {
  let tmp;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-parity-test-"));
    scaffoldRepo(tmp);
  });

  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("passes with a complete stoplist", () => {
    const errors = checkStoplistContent(tmp);
    assert.equal(errors.length, 0, `unexpected errors: ${errors.join(", ")}`);
  });

  it("fails when a required stoplist string is missing", () => {
    // Overwrite pipeline.md without the stoplist content
    const pipelinePath = path.join(tmp, ".codex", "rules", "pipeline.md");
    fs.writeFileSync(pipelinePath, "# Pipeline\n\n## Tracks\n| full |\n");
    const errors = checkStoplistContent(tmp);
    assert.ok(errors.length > 0, "should have errors when stoplist content is missing");
    assert.ok(errors.some((e) => e.includes("Safety stoplist")));
    // Restore
    fs.writeFileSync(pipelinePath, [
      "# Pipeline",
      "## Safety stoplist",
      "- Authentication",
      "- Cryptography",
      "- PII",
      "## Tracks",
    ].join("\n"));
  });

  it("main() returns non-zero when stoplist string is missing", () => {
    const pipelinePath = path.join(tmp, ".codex", "rules", "pipeline.md");
    const original = fs.readFileSync(pipelinePath, "utf8");
    // Remove the word "Authentication" from pipeline.md
    fs.writeFileSync(pipelinePath, original.replace(/Authentication/g, "REMOVED"));
    const result = main(tmp);
    assert.notEqual(result, 0, "main() should fail when stoplist content is missing");
    // Restore
    fs.writeFileSync(pipelinePath, original);
  });
});

// ---------------------------------------------------------------------------
// Case 3: role-prompt min-line check
// ---------------------------------------------------------------------------

describe("parity-check — role prompt line counts", () => {
  let tmp;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-parity-roles-"));
    scaffoldRepo(tmp);
  });

  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("passes when all role prompts are >= 60 lines", () => {
    const errors = checkRolePromptLines(tmp);
    assert.equal(errors.length, 0, `unexpected errors: ${errors.join(", ")}`);
  });

  it("fails when a role prompt is too short", () => {
    const shortContent = "# PM\nToo short.\n";
    const pmPath = path.join(tmp, ".codex", "prompts", "roles", "pm.md");
    fs.writeFileSync(pmPath, shortContent);
    const errors = checkRolePromptLines(tmp);
    assert.ok(errors.length > 0, "should have errors for short role prompt");
    assert.ok(errors.some((e) => e.includes("pm.md")));
    // Restore
    const longContent = ["# PM Role\n", ...Array(65).fill("Some content.\n")].join("");
    fs.writeFileSync(pmPath, longContent);
  });

  it("main() returns non-zero when a role prompt is too short", () => {
    const shortContent = "# Reviewer\nToo short.\n";
    const reviewerPath = path.join(tmp, ".codex", "prompts", "roles", "reviewer.md");
    const original = fs.readFileSync(reviewerPath, "utf8");
    fs.writeFileSync(reviewerPath, shortContent);
    const result = main(tmp);
    assert.notEqual(result, 0, "main() should fail when a role prompt is too short");
    // Restore
    fs.writeFileSync(reviewerPath, original);
  });
});
