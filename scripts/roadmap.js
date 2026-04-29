#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROADMAP = path.join(process.cwd(), "docs", "audit", "10-roadmap.md");

function parseItem(line) {
  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  return {
    id: Number(cells[0]),
    item: cells[1] || "",
    impact: cells[2] || "",
    effort: cells[3] || "",
    risk: cells[4] || "",
    verification: cells[5] || "",
    areas: cells[6] || "",
    done: line.includes("[DONE]"),
    raw: line,
  };
}

function roadmapPayload() {
  if (!fs.existsSync(ROADMAP)) {
    return {
      exists: false,
      path: "docs/audit/10-roadmap.md",
      items: [],
      done: 0,
      remaining: 0,
      next: [],
    };
  }

  const lines = fs.readFileSync(ROADMAP, "utf8").split(/\r?\n/);
  const items = lines.filter((line) => /^\|\s*\d+\s*\|/.test(line)).map(parseItem);
  const done = items.filter((item) => item.done);
  const next = items.filter((item) => !item.done).slice(0, 3);
  return {
    exists: true,
    path: "docs/audit/10-roadmap.md",
    items,
    done: done.length,
    remaining: items.length - done.length,
    next,
  };
}

function main() {
  const payload = roadmapPayload();

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!payload.exists) {
    console.log("No roadmap found. Run the audit skill to generate one.");
    return;
  }

  console.log("Improvement Roadmap");
  console.log("===================");
  console.log(`Items: ${payload.items.length}`);
  console.log(`Done: ${payload.done}`);
  console.log(`Remaining: ${payload.remaining}`);

  if (payload.next.length > 0) {
    console.log("");
    console.log("Next up:");
    for (const item of payload.next) console.log(`- ${item.raw}`);
  }
}

main();

module.exports = { parseItem, roadmapPayload };
