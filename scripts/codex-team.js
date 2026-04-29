#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = process.cwd();
const TEMPLATE_DIR = path.join(ROOT, "templates");

const STAGES = {
  requirements: {
    stage: "stage-01",
    role: "PM",
    objective: "Turn the feature request into requirements, acceptance criteria, and scope boundaries.",
    readFirst: ["AGENTS.md", ".codex/rules/pipeline.md", ".codex/rules/gates.md", "pipeline/context.md"],
    allowedWrites: ["pipeline/brief.md", "pipeline/gates/stage-01.json", "pipeline/context.md"],
    artifact: "pipeline/brief.md",
    template: "brief-template.md",
    gate: {
      agent: "pm",
      acceptance_criteria_count: 0,
      out_of_scope_items: [],
      required_sections_complete: false,
    },
  },
  design: {
    stage: "stage-02",
    role: "Principal",
    objective: "Convert approved requirements into an implementable architecture and explicit decisions.",
    readFirst: ["AGENTS.md", ".codex/rules/pipeline.md", ".codex/rules/gates.md", "pipeline/context.md", "pipeline/brief.md"],
    allowedWrites: ["pipeline/design-spec.md", "pipeline/adr/", "pipeline/gates/stage-02.json", "pipeline/context.md"],
    artifact: "pipeline/design-spec.md",
    template: "design-spec-template.md",
    gate: {
      agent: "principal",
      arch_approved: false,
      pm_approved: false,
      adr_count: 0,
    },
  },
  review: {
    stage: "stage-05-backend",
    role: "Reviewer",
    objective: "Review peer implementation notes, record findings, and derive deterministic approval gates.",
    readFirst: ["AGENTS.md", ".codex/rules/pipeline.md", ".codex/rules/gates.md", "pipeline/context.md", "pipeline/pr-*.md"],
    allowedWrites: ["pipeline/code-review/by-<role>.md", "pipeline/gates/stage-05-*.json"],
    artifact: "pipeline/code-review/by-backend.md",
    template: "review-template.md",
    gate: {
      agent: "codex-team",
      area: "backend",
      review_shape: "matrix",
      required_approvals: 2,
      approvals: [],
      changes_requested: [],
      escalated_to_principal: false,
    },
  },
  qa: {
    stage: "stage-07",
    role: "QA",
    objective: "Verify every acceptance criterion with a one-to-one test mapping and report results.",
    readFirst: ["AGENTS.md", ".codex/rules/pipeline.md", ".codex/rules/gates.md", "pipeline/context.md", "pipeline/brief.md", "pipeline/design-spec.md"],
    allowedWrites: ["src/tests/", "pipeline/test-report.md", "pipeline/gates/stage-07.json", "pipeline/context.md"],
    artifact: "pipeline/test-report.md",
    template: "test-report-template.md",
    gate: {
      agent: "qa",
      all_acceptance_criteria_met: false,
      tests_total: 0,
      tests_passed: 0,
      tests_failed: 0,
      failing_tests: [],
      criterion_to_test_mapping_is_one_to_one: false,
    },
  },
  deploy: {
    stage: "stage-08",
    role: "Platform",
    objective: "Prepare deployment, confirm PM sign-off, and record rollback and health checks.",
    readFirst: ["AGENTS.md", ".codex/rules/pipeline.md", ".codex/rules/gates.md", "pipeline/context.md", "pipeline/test-report.md"],
    allowedWrites: ["pipeline/runbook.md", "pipeline/deploy-log.md", "pipeline/gates/stage-08.json", "pipeline/context.md"],
    artifact: "pipeline/runbook.md",
    template: "runbook-template.md",
    gate: {
      agent: "platform",
      pm_signoff: false,
      deploy_requested: false,
      runbook_referenced: false,
    },
  },
  retrospective: {
    stage: "stage-09",
    role: "Principal",
    objective: "Synthesize the run, capture durable lessons, and close the pipeline loop.",
    readFirst: ["AGENTS.md", ".codex/rules/pipeline.md", ".codex/rules/gates.md", "pipeline/context.md", "pipeline/lessons-learned.md"],
    allowedWrites: ["pipeline/retrospective.md", "pipeline/lessons-learned.md", "pipeline/gates/stage-09.json", "pipeline/context.md"],
    artifact: "pipeline/retrospective.md",
    template: "retrospective-template.md",
    gate: {
      agent: "principal",
      severity: "green",
      lessons_promoted: [],
      patterns_harvested: 0,
      contributions_written: [],
    },
  },
};

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function runNodeScript(script, args = []) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
  });
  return result.status || 0;
}

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATE_DIR, name), "utf8");
}

function writeIfMissing(relativePath, content) {
  const full = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (!fs.existsSync(full)) {
    fs.writeFileSync(full, content.endsWith("\n") ? content : `${content}\n`);
    return true;
  }
  return false;
}

function currentTrack() {
  return "full";
}

function draftGate(stageConfig) {
  const gate = {
    stage: stageConfig.stage,
    status: "FAIL",
    agent: stageConfig.gate.agent,
    track: currentTrack(),
    timestamp: new Date().toISOString(),
    blockers: ["Draft gate generated by codex-team stage scaffold"],
    warnings: [],
    ...stageConfig.gate,
  };

  const gatePath = path.join(ROOT, "pipeline", "gates", `${stageConfig.stage}.json`);
  fs.mkdirSync(path.dirname(gatePath), { recursive: true });
  if (!fs.existsSync(gatePath)) {
    fs.writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`);
    return true;
  }
  return false;
}

function scaffoldStage(name) {
  const config = STAGES[name];
  if (!config) {
    console.error(`Unknown stage: ${name}`);
    console.error(`Known stages: ${Object.keys(STAGES).join(", ")}`);
    return 1;
  }

  const artifactCreated = writeIfMissing(config.artifact, readTemplate(config.template));
  const gateCreated = draftGate(config);
  console.log(`${artifactCreated ? "created" : "exists"} ${config.artifact}`);
  console.log(`${gateCreated ? "created" : "exists"} pipeline/gates/${config.stage}.json`);
  return 0;
}

function printList(title, items) {
  console.log(`${title}:`);
  for (const item of items) console.log(`- ${item}`);
}

function promptForStage(name, feature) {
  const config = STAGES[name];
  if (!config) {
    console.error(`Unknown stage: ${name}`);
    console.error(`Known stages: ${Object.keys(STAGES).join(", ")}`);
    return 1;
  }

  console.log(`Role: ${config.role}`);
  console.log(`Stage: ${config.stage} (${name})`);
  console.log(`Track: ${currentTrack()}`);
  if (feature) console.log(`Feature: ${feature}`);
  console.log(`Objective: ${config.objective}`);
  console.log("");
  printList("Read first", config.readFirst);
  console.log("");
  printList("Allowed writes", config.allowedWrites);
  console.log("");
  printList("Expected artifacts", [config.artifact, `pipeline/gates/${config.stage}.json`]);
  console.log("");
  console.log("Gate:");
  console.log(`- Write pipeline/gates/${config.stage}.json with base fields and stage-specific fields.`);
  console.log("- Set status to PASS only when the deterministic criteria are satisfied.");
  console.log("");
  printList("Verification", ["npm run validate", "npm run status"]);
  return 0;
}

function printContext() {
  const contextPath = path.join(ROOT, "pipeline", "context.md");
  if (fs.existsSync(contextPath)) {
    console.log(fs.readFileSync(contextPath, "utf8").trimEnd());
  } else {
    console.log("No pipeline/context.md found.");
  }

  console.log("");
  return runNodeScript("status.js");
}

function runPipeline(feature) {
  const status = newPipeline(feature);
  if (status !== 0) return status;
  const stageStatus = scaffoldStage("requirements");
  if (stageStatus !== 0) return stageStatus;
  console.log("");
  console.log("Next: complete pipeline/brief.md, write the Stage 1 gate, then run npm run validate.");
  return 0;
}

function runDesign(feature) {
  const status = newPipeline(feature);
  if (status !== 0) return status;
  const requirementsStatus = scaffoldStage("requirements");
  if (requirementsStatus !== 0) return requirementsStatus;
  const designStatus = scaffoldStage("design");
  if (designStatus !== 0) return designStatus;
  console.log("");
  console.log("Next: complete requirements and design artifacts, then run npm run validate.");
  return 0;
}

function runPipelineReview() {
  const stageStatus = scaffoldStage("review");
  if (stageStatus !== 0) return stageStatus;
  return runNodeScript("approval-derivation.js");
}

function runRetrospective() {
  const stageStatus = scaffoldStage("retrospective");
  if (stageStatus !== 0) return stageStatus;
  console.log("");
  console.log("Next: add durable LESSON: lines, then run npm run lessons -- promote.");
  return 0;
}

function newPipeline(name) {
  fs.mkdirSync(path.join(ROOT, "pipeline", "gates"), { recursive: true });
  fs.mkdirSync(path.join(ROOT, "pipeline", "adr"), { recursive: true });
  fs.mkdirSync(path.join(ROOT, "pipeline", "code-review"), { recursive: true });
  writeIfMissing("pipeline/context.md", "# Project Context\n\n## Fix Log\n");
  writeIfMissing("pipeline/lessons-learned.md", "# Lessons Learned\n\n---\n");
  if (name) {
    fs.appendFileSync(
      path.join(ROOT, "pipeline", "context.md"),
      `\n${new Date().toISOString()} - Pipeline started: ${name}\n`,
    );
  }
  console.log("Pipeline workspace ready.");
  return 0;
}

function reset() {
  const archiveDir = path.join(ROOT, "pipeline", "archive");
  const context = path.join(ROOT, "pipeline", "context.md");
  fs.mkdirSync(archiveDir, { recursive: true });

  if (fs.existsSync(context)) {
    const stamp = new Date().toISOString().replaceAll(":", "-");
    fs.copyFileSync(context, path.join(archiveDir, `context-${stamp}.md`));
  }

  for (const relative of [
    "pipeline/gates",
    "pipeline/code-review",
    "pipeline/adr",
  ]) {
    const full = path.join(ROOT, relative);
    fs.rmSync(full, { recursive: true, force: true });
    fs.mkdirSync(full, { recursive: true });
  }

  console.log("Pipeline runtime state reset. Context archive preserved.");
  return 0;
}

function doctor() {
  const checks = [
    ["AGENTS.md", exists("AGENTS.md")],
    [".codex/config.yml", exists(".codex/config.yml")],
    [".codex/skills/pipeline/SKILL.md", exists(".codex/skills/pipeline/SKILL.md")],
    ["schemas/gate.schema.json", exists("schemas/gate.schema.json")],
    ["scripts/gate-validator.js", exists("scripts/gate-validator.js")],
    ["pipeline/context.md", exists("pipeline/context.md")],
    ["pipeline/lessons-learned.md", exists("pipeline/lessons-learned.md")],
  ];

  let failed = false;
  for (const [name, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
    failed = failed || !ok;
  }

  return failed ? 1 : 0;
}

function validate() {
  const lint = runNodeScript("lint-syntax.js");
  if (lint !== 0) return lint;
  return runNodeScript("gate-validator.js");
}

function usage() {
  console.log([
    "Usage: codex-team <command>",
    "",
    "Core:",
    "  status | roadmap | validate | doctor | reset",
    "  review | security | runbook | lessons",
    "  audit | audit-quick | health-check",
    "",
    "Pipeline:",
    "  pipeline <feature>",
    "  pipeline:new <feature>",
    "  pipeline-brief [feature]",
    "  design <feature>",
    "  pipeline-review",
    "  pipeline-context",
    "  retrospective",
    "  prompt <stage> [feature]",
    "  stage <requirements|design|review|qa|deploy|retrospective>",
  ].join("\n"));
  return 1;
}

function main() {
  const command = process.argv[2];
  if (command === "status") return runNodeScript("status.js");
  if (command === "roadmap") return runNodeScript("roadmap.js");
  if (command === "validate") return validate();
  if (command === "doctor") return doctor();
  if (command === "reset") return reset();
  if (command === "review") return runNodeScript("approval-derivation.js");
  if (command === "security") return runNodeScript("security-heuristic.js", process.argv.slice(3));
  if (command === "runbook") return runNodeScript("runbook-check.js");
  if (command === "audit") return runNodeScript("audit.js", ["full", ...process.argv.slice(3)]);
  if (command === "audit-quick") return runNodeScript("audit.js", ["quick", ...process.argv.slice(3)]);
  if (command === "health-check") return runNodeScript("audit.js", ["health-check", ...process.argv.slice(3)]);
  if (command === "pipeline") return runPipeline(process.argv.slice(3).join(" "));
  if (command === "pipeline:new") return newPipeline(process.argv.slice(3).join(" "));
  if (command === "pipeline-brief") {
    const feature = process.argv.slice(3).join(" ");
    if (feature) newPipeline(feature);
    return scaffoldStage("requirements");
  }
  if (command === "design") return runDesign(process.argv.slice(3).join(" "));
  if (command === "pipeline-review") return runPipelineReview();
  if (command === "pipeline-context") return printContext();
  if (command === "retrospective") return runRetrospective();
  if (command === "prompt") return promptForStage(process.argv[3], process.argv.slice(4).join(" "));
  if (command === "stage") return scaffoldStage(process.argv[3]);
  if (command === "lessons") return runNodeScript("lessons.js", process.argv.slice(3));
  return usage();
}

process.exit(main());
