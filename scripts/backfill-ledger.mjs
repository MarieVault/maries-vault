// One-time backfill of existing Choice/Change/Studio images into the Vault
// storage ledger. Idempotent via the UNIQUE(app, path) constraint on the
// storage_entries table. Re-running is a no-op for rows already present.
//
// Usage:
//   VAULT_SERVICE_SECRET=... node scripts/backfill-ledger.mjs
//   node scripts/backfill-ledger.mjs --dry-run
//
// The three app SQLite DBs + media dirs are discovered at fixed paths:
//   /root/maries-choice/backend/maries-choice.db    + media/generated
//   /root/change-room/backend/change-room.db        + media/generated
//   /root/studio-mariesvault/backend/studio.db      + media/generated

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const VAULT_URL = process.env.VAULT_INTERNAL_URL || "http://localhost:4000";
const SECRET    = process.env.VAULT_SERVICE_SECRET || "";
const DRY_RUN   = process.argv.includes("--dry-run");

if (!SECRET && !DRY_RUN) {
  console.error("VAULT_SERVICE_SECRET not set. Export it or pass --dry-run.");
  process.exit(1);
}

function mimeFor(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png")  return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return null;
}

async function recordOne({ userId, app, kind, absPath, sessionRef, meta }) {
  if (!fs.existsSync(absPath)) return { skipped: "missing" };
  const size = fs.statSync(absPath).size;
  if (DRY_RUN) return { dry: true, size };
  const res = await fetch(`${VAULT_URL}/api/ledger/record`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-service-secret": SECRET },
    body: JSON.stringify({
      user_id: userId, app, kind,
      path: absPath,
      size_bytes: size,
      mime: mimeFor(absPath),
      session_ref: sessionRef ?? null,
      meta: meta ?? null,
    }),
  });
  if (!res.ok) return { error: `${res.status} ${await res.text().catch(() => "")}` };
  const json = await res.json().catch(() => ({}));
  return { id: json.id ?? null }; // id === null means duplicate (already present)
}

async function backfillApp(appName, rows) {
  let inserted = 0, duplicate = 0, missing = 0, failed = 0;
  for (const row of rows) {
    const result = await recordOne(row);
    if (result.dry) inserted++;
    else if (result.skipped === "missing") missing++;
    else if (result.error) { failed++; console.warn(`  [${appName}] fail ${row.absPath}: ${result.error}`); }
    else if (result.id == null) duplicate++;
    else inserted++;
  }
  console.log(`[${appName}] inserted=${inserted} duplicate=${duplicate} missing=${missing} failed=${failed}`);
}

// ── Choice ──────────────────────────────────────────────────────────────────
function choiceRows() {
  const db = new Database("/root/maries-choice/backend/maries-choice.db", { readonly: true });
  const mediaDir = "/root/maries-choice/backend/media/generated";
  const rows = db.prepare(`
    SELECT filename, user_id, session_id, seed, prompt, created_at
    FROM generated_images
    WHERE user_id IS NOT NULL
  `).all();
  db.close();
  return rows.map(r => ({
    userId: Number(r.user_id),
    app: "choice",
    kind: "image",
    absPath: path.join(mediaDir, r.filename),
    sessionRef: r.session_id || null,
    meta: { seed: r.seed, prompt: (r.prompt || "").slice(0, 200), backfilled: true },
  }));
}

// ── Change Room ─────────────────────────────────────────────────────────────
function changeRows() {
  const db = new Database("/root/change-room/backend/change-room.db", { readonly: true });
  const mediaDir = "/root/change-room/backend/media/generated";
  const rows = db.prepare(`
    SELECT s.image_path AS filename, s.id AS step_id, s.session_id, s.step_number, s.image_seed,
           se.user_id
    FROM steps s
    JOIN sessions se ON se.id = s.session_id
    WHERE s.image_path IS NOT NULL AND se.user_id IS NOT NULL
  `).all();
  db.close();
  // Dedup filename — same image can be referenced by multiple steps after a revert.
  const byPath = new Map();
  for (const r of rows) {
    const abs = path.join(mediaDir, r.filename);
    if (!byPath.has(abs)) {
      byPath.set(abs, {
        userId: Number(r.user_id),
        app: "change",
        kind: "image",
        absPath: abs,
        sessionRef: r.session_id,
        meta: { stepId: r.step_id, stepNumber: r.step_number, seed: r.image_seed, backfilled: true },
      });
    }
  }
  return [...byPath.values()];
}

// ── Studio ──────────────────────────────────────────────────────────────────
function studioRows() {
  const db = new Database("/root/studio-mariesvault/backend/studio.db", { readonly: true });
  const mediaDir = "/root/studio-mariesvault/backend/media/generated";
  const rows = db.prepare(`
    SELECT gi.filename, gi.generation_id, gi.slot, gi.seed,
           g.user_id, g.character_state
    FROM generation_images gi
    JOIN generations g ON g.id = gi.generation_id
    WHERE g.user_id IS NOT NULL
  `).all();
  db.close();
  return rows.map(r => ({
    userId: Number(r.user_id),
    app: "studio",
    kind: "image",
    absPath: path.join(mediaDir, r.filename),
    sessionRef: r.generation_id,
    meta: { slot: r.slot, seed: r.seed, backfilled: true },
  }));
}

// ── Run ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN ? "DRY RUN — no writes" : `Writing to ${VAULT_URL}`);
  const choice = choiceRows();
  const change = changeRows();
  const studio = studioRows();
  console.log(`Candidates: choice=${choice.length} change=${change.length} studio=${studio.length}`);
  await backfillApp("choice", choice);
  await backfillApp("change", change);
  await backfillApp("studio", studio);
}

main().catch(e => { console.error(e); process.exit(1); });
