#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = process.cwd();

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
  console.log("Usage: codex-team <status|roadmap|validate|doctor|reset>");
  return 1;
}

function main() {
  const command = process.argv[2];
  if (command === "status") return runNodeScript("status.js");
  if (command === "roadmap") return runNodeScript("roadmap.js");
  if (command === "validate") return validate();
  if (command === "doctor") return doctor();
  if (command === "reset") return reset();
  return usage();
}

process.exit(main());
