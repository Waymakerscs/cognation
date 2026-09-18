#!/usr/bin/env node
/**
 * Mirror a CognationModeration newsModerationFile into
 * /workspace/news-moderation/queue/pending/RPT-*.json
 *
 * Usage:
 *   node scripts/mirror-moderation-pending.mjs < report.json
 *   node scripts/mirror-moderation-pending.mjs path/to/report.json
 */
import fs from "fs";
import path from "path";

const PENDING = "/workspace/news-moderation/queue/pending";
const arg = process.argv[2];
let raw = "";
if (arg && arg !== "-") {
  raw = fs.readFileSync(arg, "utf8");
} else {
  raw = fs.readFileSync(0, "utf8");
}
const doc = JSON.parse(raw);
if (!doc || !doc.id) {
  console.error("Expected news-moderation file with id");
  process.exit(1);
}
fs.mkdirSync(PENDING, { recursive: true });
const out = path.join(PENDING, doc.id + ".json");
fs.writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
console.log("Wrote", out);
