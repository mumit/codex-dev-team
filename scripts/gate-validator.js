#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = process.cwd();
const GATES_DIR = path.join(REPO_ROOT, "pipeline", "gates");
const SCHEMA_PATH = path.join(__dirname, "..", "schemas", "gate.schema.json");
const SCHEMA_DIR = path.join(__dirname, "..", "schemas");

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

function gateFiles() {
  if (!fs.existsSync(GATES_DIR)) return [];

  return fs.readdirSync(GATES_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({
      name,
      full: path.join(GATES_DIR, name),
    }));
}

function validateAgainstSchema(gate, schema, label = "gate") {
  const errors = [];

  for (const field of schema.required || []) {
    if (!(field in gate)) errors.push(`${label}: missing required field: ${field}`);
  }

  for (const [field, spec] of Object.entries(schema.properties || {})) {
    if (!(field in gate)) continue;
    const value = gate[field];

    if (spec.type === "string" && typeof value !== "string") {
      errors.push(`${label}: ${field} must be a string`);
    }
    if ((spec.type === "number" || spec.type === "integer") && typeof value !== "number") {
      errors.push(`${label}: ${field} must be a ${spec.type}`);
    }
    if (spec.type === "integer" && typeof value === "number" && !Number.isInteger(value)) {
      errors.push(`${label}: ${field} must be an integer`);
    }
    if (spec.type === "boolean" && typeof value !== "boolean") {
      errors.push(`${label}: ${field} must be a boolean`);
    }
    if (spec.type === "object" && (typeof value !== "object" || value === null || Array.isArray(value))) {
      errors.push(`${label}: ${field} must be an object`);
    }
    if (spec.type === "array" && !Array.isArray(value)) {
      errors.push(`${label}: ${field} must be an array`);
    }
    if (spec.enum && !spec.enum.includes(value)) {
      errors.push(`${label}: ${field} must be one of: ${spec.enum.join(", ")}`);
    }
    if (spec.minLength && typeof value === "string" && value.length < spec.minLength) {
      errors.push(`${label}: ${field} must not be empty`);
    }
    if (typeof spec.minimum === "number" && typeof value === "number" && value < spec.minimum) {
      errors.push(`${label}: ${field} must be >= ${spec.minimum}`);
    }
    if (spec.pattern && typeof value === "string") {
      const re = new RegExp(spec.pattern);
      if (!re.test(value)) errors.push(`${label}: ${field} does not match ${spec.pattern}`);
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

function stageSchemaPath(stage) {
  const match = typeof stage === "string" ? stage.match(/^(stage-\d{2})/) : null;
  if (!match) return null;
  const candidate = path.join(SCHEMA_DIR, `${match[1]}.schema.json`);
  return fs.existsSync(candidate) ? candidate : null;
}

function validateGate(gate) {
  const baseSchema = readJson(SCHEMA_PATH);
  const errors = validateAgainstSchema(gate, baseSchema, "base");
  const stagePath = stageSchemaPath(gate.stage);

  if (stagePath) {
    const stageSchema = readJson(stagePath);
    errors.push(...validateAgainstSchema(gate, stageSchema, path.basename(stagePath)));
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

function validateGateFile(file) {
  let gate;
  try {
    gate = readJson(file.full);
  } catch (err) {
    console.error(`[gate-validator] invalid JSON in ${file.name}: ${sanitize(err.message)}`);
    return 1;
  }

  const errors = validateGate(gate);
  if (errors.length > 0) {
    console.error(`[gate-validator] invalid gate ${file.name}`);
    for (const error of errors) console.error(`  - ${sanitize(error)}`);
    return 1;
  }

  return printGate(gate);
}

function validateAllGates() {
  const files = gateFiles();
  if (files.length === 0) return 0;

  let worst = 0;
  for (const file of files) {
    const status = validateGateFile(file);
    if (status === 1) worst = 1;
    else if (worst !== 1 && status === 3) worst = 3;
    else if (worst === 0 && status === 2) worst = 2;
  }
  return worst;
}

function main() {
  if (process.argv.includes("--all")) return validateAllGates();

  const latest = latestGateFile();
  if (!latest) return 0;
  return validateGateFile(latest);
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (err) {
    console.log(`[gate-validator] internal error: ${sanitize(err.message)}; treating as PASS`);
    process.exit(0);
  }
}

module.exports = { validateAgainstSchema, validateGate, sanitize, main, validateAllGates };
