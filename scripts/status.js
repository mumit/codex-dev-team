#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const GATES_DIR = path.join(process.cwd(), "pipeline", "gates");

function gates() {
  if (!fs.existsSync(GATES_DIR)) return [];
  return fs.readdirSync(GATES_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const full = path.join(GATES_DIR, name);
      try {
        return { name, gate: JSON.parse(fs.readFileSync(full, "utf8")) };
      } catch {
        return { name, gate: { status: "INVALID", stage: name } };
      }
    });
}

function main() {
  const rows = gates();
  console.log("Codex Dev Team Status");
  console.log("=====================");

  if (rows.length === 0) {
    console.log("No gate files found.");
    return;
  }

  for (const { name, gate } of rows) {
    const blockers = Array.isArray(gate.blockers) && gate.blockers.length > 0
      ? ` blockers=${gate.blockers.length}`
      : "";
    console.log(`${name}: ${gate.status} ${gate.stage || ""} ${gate.agent || ""}${blockers}`.trim());
  }
}

main();
