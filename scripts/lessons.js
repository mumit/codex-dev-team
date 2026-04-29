#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const LESSONS = path.join(ROOT, "pipeline", "lessons-learned.md");
const RETRO = path.join(ROOT, "pipeline", "retrospective.md");

function ensureLessonsFile() {
  fs.mkdirSync(path.dirname(LESSONS), { recursive: true });
  if (!fs.existsSync(LESSONS)) {
    fs.writeFileSync(LESSONS, "# Lessons Learned\n\n---\n");
  }
}

function nextLessonId(content) {
  const ids = [...content.matchAll(/^### L(\d+)/gm)].map((match) => Number(match[1]));
  const next = ids.length === 0 ? 1 : Math.max(...ids) + 1;
  return `L${String(next).padStart(3, "0")}`;
}

function extractLessons(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*LESSON:\s*(.+?)\s*$/i))
    .filter(Boolean)
    .map((match) => match[1]);
}

function promoteFromRetrospective() {
  ensureLessonsFile();

  if (!fs.existsSync(RETRO)) {
    console.error("No retrospective found at pipeline/retrospective.md");
    return 1;
  }

  const proposed = extractLessons(fs.readFileSync(RETRO, "utf8"));
  if (proposed.length === 0) {
    console.log("No LESSON: lines found in retrospective.");
    return 0;
  }

  let lessons = fs.readFileSync(LESSONS, "utf8");
  let promoted = 0;

  for (const text of proposed) {
    if (lessons.includes(`**Rule:** ${text}`)) continue;
    const id = nextLessonId(lessons);
    const entry = [
      "",
      `### ${id} - Promoted lesson`,
      `**Added:** ${new Date().toISOString().slice(0, 10)}`,
      "**Reinforced:** 0",
      `**Rule:** ${text}`,
      "",
    ].join("\n");
    lessons += entry;
    promoted++;
  }

  fs.writeFileSync(LESSONS, lessons.endsWith("\n") ? lessons : `${lessons}\n`);
  console.log(`Promoted ${promoted} lesson(s).`);
  return 0;
}

function showLessons() {
  ensureLessonsFile();
  process.stdout.write(fs.readFileSync(LESSONS, "utf8"));
  return 0;
}

function usage() {
  console.log("Usage: lessons <show|promote>");
  return 1;
}

function main() {
  const command = process.argv[2] || "show";
  if (command === "show") return showLessons();
  if (command === "promote") return promoteFromRetrospective();
  return usage();
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { extractLessons, promoteFromRetrospective, showLessons };
