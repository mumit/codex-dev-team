#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "docs", "pr", "stack.md");

function git(args) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) return "";
  return result.stdout.trim();
}

function commitList(fromRef) {
  const args = ["log", "--reverse", "--oneline", "--decorate=short"];
  if (fromRef) args.push(`${fromRef}..HEAD`);
  const output = git(args);
  return output ? output.split(/\r?\n/) : [];
}

function changedFiles(fromRef) {
  const args = fromRef
    ? ["diff", "--name-only", `${fromRef}..HEAD`]
    : ["ls-tree", "-r", "--name-only", "HEAD"];
  const output = git(args);
  return output ? [...new Set(output.split(/\r?\n/).filter(Boolean))].sort() : [];
}

function currentBranch() {
  return git(["branch", "--show-current"]) || "unknown";
}

function buildPack(fromRef) {
  const branch = currentBranch();
  const commits = commitList(fromRef);
  const files = changedFiles(fromRef);
  const lines = [
    "# PR Stack Notes",
    "",
    `Branch: ${branch}`,
    `Base: ${fromRef || "not specified"}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    "Local framework work prepared for future PR slicing.",
    "",
    "## Commits",
    "",
  ];

  if (commits.length === 0) lines.push("- No commits found.");
  else lines.push(...commits.map((commit) => `- ${commit}`));

  lines.push("", "## Changed Files", "");
  if (files.length === 0) lines.push("- No changed files found.");
  else lines.push(...files.map((file) => `- ${file}`));

  lines.push(
    "",
    "## Verification Checklist",
    "",
    "- npm run lint",
    "- npm test",
    "- npm run validate",
    "- npm run doctor",
    "- npm run release:check",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function main() {
  const fromRef = process.argv[2];
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, buildPack(fromRef));
  console.log("wrote docs/pr/stack.md");
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { buildPack };
