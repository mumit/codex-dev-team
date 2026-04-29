#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROADMAP = path.join(process.cwd(), "docs", "audit", "10-roadmap.md");

function main() {
  if (!fs.existsSync(ROADMAP)) {
    console.log("No roadmap found. Run the audit skill to generate one.");
    return;
  }

  const lines = fs.readFileSync(ROADMAP, "utf8").split(/\r?\n/);
  const items = lines.filter((line) => /^\|\s*\d+\s*\|/.test(line));
  const done = items.filter((line) => line.includes("[DONE]"));

  console.log("Improvement Roadmap");
  console.log("===================");
  console.log(`Items: ${items.length}`);
  console.log(`Done: ${done.length}`);
  console.log(`Remaining: ${items.length - done.length}`);

  const next = items.filter((line) => !line.includes("[DONE]")).slice(0, 3);
  if (next.length > 0) {
    console.log("");
    console.log("Next up:");
    for (const line of next) console.log(`- ${line}`);
  }
}

main();
