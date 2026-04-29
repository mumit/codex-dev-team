#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DIRS = ["scripts", "tests"];

function jsFiles(dir) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return [];
  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(fullDir, entry.name);
    if (entry.isDirectory()) return jsFiles(path.join(dir, entry.name));
    return entry.name.endsWith(".js") ? [full] : [];
  });
}

let failed = false;
for (const file of DIRS.flatMap(jsFiles)) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failed = true;
    console.error(result.stderr || result.stdout);
  }
}

process.exit(failed ? 1 : 0);
