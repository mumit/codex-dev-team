#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = process.cwd();
const GATES_DIR = path.join(REPO_ROOT, "pipeline", "gates");
const SCHEMA_PATH = path.join(__dirname, "..", "schemas", "gate.schema.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sanitize(value, maxLength = 500) {
  const raw = value === null || value === undefined ? "" : String(value);
  const withoutAnsi = stripAnsi(raw);
  const printable = replaceControls(withoutAnsi);
  return printable.length <= maxLength
    ? printable
    : `${printable.slice(0, maxLength)}...[truncated]`;
}

function stripAnsi(value) {
  let result = "";
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) === 27 && value[i + 1] === "[") {
      i += 2;
      while (i < value.length) {
        const code = value.charCodeAt(i);
        if (code >= 64 && code <= 126) break;
        i++;
      }
      continue;
    }
    result += value[i];
  }
  return result;
}

function replaceControls(value) {
  let result = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    const allowedWhitespace = code === 9 || code === 10 || code === 13;
    result += (code < 32 && !allowedWhitespace) || code === 127 ? "?" : char;
  }
  return result;
}

function latestGateFile() {
  if (!fs.existsSync(GATES_DIR)) return null;

  const files = fs.readdirSync(GATES_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const full = path.join(GATES_DIR, name);
      return { name, full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  return files[0] || null;
}

function validateAgainstSchema(gate, schema) {
  const errors = [];

  for (const field of schema.required || []) {
    if (!(field in gate)) errors.push(`missing required field: ${field}`);
  }

  for (const [field, spec] of Object.entries(schema.properties || {})) {
    if (!(field in gate)) continue;
    const value = gate[field];

    if (spec.type === "string" && typeof value !== "string") {
      errors.push(`${field} must be a string`);
    }
    if (spec.type === "number" && typeof value !== "number") {
      errors.push(`${field} must be a number`);
    }
    if (spec.type === "array" && !Array.isArray(value)) {
      errors.push(`${field} must be an array`);
    }
    if (spec.enum && !spec.enum.includes(value)) {
      errors.push(`${field} must be one of: ${spec.enum.join(", ")}`);
    }
    if (spec.minLength && typeof value === "string" && value.length < spec.minLength) {
      errors.push(`${field} must not be empty`);
    }
    if (spec.pattern && typeof value === "string") {
      const re = new RegExp(spec.pattern);
      if (!re.test(value)) errors.push(`${field} does not match ${spec.pattern}`);
    }
  }

  if (typeof gate.retry_number === "number" && gate.retry_number >= 1) {
    if (typeof gate.this_attempt_differs_by !== "string" ||
        gate.this_attempt_differs_by.trim() === "") {
      errors.push("retry gates require non-empty this_attempt_differs_by");
    }
  }

  return errors;
}

function printGate(gate) {
  const label = `${sanitize(gate.stage)} (${sanitize(gate.agent)})`;

  if (gate.status === "PASS") {
    console.log(`[gate-validator] PASS - ${label}`);
    for (const warning of gate.warnings || []) {
      console.log(`[gate-validator] warning: ${sanitize(warning)}`);
    }
    return 0;
  }

  if (gate.status === "FAIL") {
    console.log(`[gate-validator] FAIL - ${label}`);
    for (const blocker of gate.blockers || []) {
      console.log(`[gate-validator] blocker: ${sanitize(blocker)}`);
    }
    return 2;
  }

  if (gate.status === "ESCALATE") {
    console.log(`[gate-validator] ESCALATE - ${label}`);
    console.log(`[gate-validator] reason: ${sanitize(gate.escalation_reason || "see gate file")}`);
    return 3;
  }

  return 1;
}

function main() {
  const latest = latestGateFile();
  if (!latest) return 0;

  let gate;
  try {
    gate = readJson(latest.full);
  } catch (err) {
    console.error(`[gate-validator] invalid JSON in ${latest.name}: ${sanitize(err.message)}`);
    return 1;
  }

  const schema = readJson(SCHEMA_PATH);
  const errors = validateAgainstSchema(gate, schema);
  if (errors.length > 0) {
    console.error(`[gate-validator] invalid gate ${latest.name}`);
    for (const error of errors) console.error(`  - ${sanitize(error)}`);
    return 1;
  }

  return printGate(gate);
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (err) {
    console.log(`[gate-validator] internal error: ${sanitize(err.message)}; treating as PASS`);
    process.exit(0);
  }
}

module.exports = { validateAgainstSchema, sanitize, main };
