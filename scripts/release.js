#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function releaseChecks() {
  const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
  const pkg = readJson("package.json");
  const lock = readJson("package-lock.json");
  const errors = [];

  if (pkg.version !== version) errors.push(`package.json version ${pkg.version} does not match VERSION ${version}`);
  if (lock.version !== version) errors.push(`package-lock.json version ${lock.version} does not match VERSION ${version}`);
  if (lock.packages?.[""]?.version !== version) {
    errors.push(`package-lock root package version ${lock.packages?.[""]?.version} does not match VERSION ${version}`);
  }

  for (const script of [
    "test",
    "lint",
    "validate",
    "doctor",
    "pipeline:scaffold",
    "gate:check:all",
    "summary",
  ]) {
    if (!pkg.scripts?.[script]) errors.push(`missing npm script: ${script}`);
  }

  for (const file of [
    "README.md",
    "AGENTS.md",
    ".codex/config.yml",
    ".github/workflows/test.yml",
    "scripts/codex-team.js",
    "scripts/gate-validator.js",
    "examples/tiny-app/package.json",
  ]) {
    if (!exists(file)) errors.push(`missing release file: ${file}`);
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL ${error}`);
    return 1;
  }

  console.log(`Release check OK for v${version}.`);
  return 0;
}

function gitLog(fromRef) {
  const args = ["log", "--oneline", "--decorate=short"];
  if (fromRef) args.push(`${fromRef}..HEAD`);
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) return ["No git history available."];
  return result.stdout.trim().split(/\r?\n/).filter(Boolean);
}

function writeNotes(fromRef) {
  const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
  const notesDir = path.join(ROOT, "docs", "release-notes");
  const notesPath = path.join(notesDir, `v${version}.md`);
  const commits = gitLog(fromRef);
  fs.mkdirSync(notesDir, { recursive: true });
  fs.writeFileSync(notesPath, [
    `# Release v${version}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Verification",
    "",
    "- npm run lint",
    "- npm test",
    "- npm run validate",
    "- npm run doctor",
    "",
    "## Commits",
    "",
    ...commits.map((commit) => `- ${commit}`),
    "",
  ].join("\n"));
  console.log(`wrote docs/release-notes/v${version}.md`);
  return 0;
}

function usage() {
  console.log("Usage: release <check|notes> [from-ref]");
  return 1;
}

function main() {
  const command = process.argv[2] || "check";
  if (command === "check") return releaseChecks();
  if (command === "notes") return writeNotes(process.argv[3]);
  return usage();
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { releaseChecks, writeNotes };
