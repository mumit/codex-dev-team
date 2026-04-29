#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const RUNBOOK = path.join(process.cwd(), "pipeline", "runbook.md");

function checkRunbook(content) {
  const missing = [];
  if (!/^##\s+Rollback\s*$/im.test(content)) missing.push("## Rollback");
  if (!/^##\s+Health signals\s*$/im.test(content)) missing.push("## Health signals");
  return missing;
}

function main() {
  if (!fs.existsSync(RUNBOOK)) {
    console.error("Runbook missing: pipeline/runbook.md");
    return 1;
  }

  const missing = checkRunbook(fs.readFileSync(RUNBOOK, "utf8"));
  if (missing.length > 0) {
    console.error(`Runbook missing required sections: ${missing.join(", ")}`);
    return 1;
  }

  console.log("Runbook OK");
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { checkRunbook };
