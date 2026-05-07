// One-time migration: set storage_entries.hearted=true for every image that's
// already hearted in an app's local DB. Safe to re-run (idempotent UPDATE).

import path from "path";
import Database from "better-sqlite3";

const VAULT_URL = process.env.VAULT_INTERNAL_URL || "http://localhost:4000";
const SECRET    = process.env.VAULT_SERVICE_SECRET || "";
if (!SECRET) { console.error("VAULT_SERVICE_SECRET not set"); process.exit(1); }

async function mirrorHeart(app, absPath, hearted) {
  const res = await fetch(`${VAULT_URL}/api/ledger/heart-by-path`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-service-secret": SECRET },
    body: JSON.stringify({ app, path: absPath, hearted }),
  });
  if (!res.ok) return { error: `${res.status} ${await res.text().catch(() => "")}` };
  const json = await res.json().catch(() => ({}));
  return { updated: json.updated ?? 0 };
}

async function migrate(appName, dbPath, mediaDir, sql) {
  const db = new Database(dbPath, { readonly: true });
  const rows = db.prepare(sql).all();
  db.close();
  let updated = 0, miss = 0, fail = 0;
  for (const r of rows) {
    const abs = path.join(mediaDir, r.filename);
    const { updated: n, error } = await mirrorHeart(appName, abs, true);
    if (error) { fail++; console.warn(`  [${appName}] ${abs}: ${error}`); }
    else if (!n) miss++;
    else updated += n;
  }
  console.log(`[${appName}] candidates=${rows.length} updated=${updated} miss=${miss} fail=${fail}`);
}

await migrate("change", "/root/change-room/backend/change-room.db",
  "/root/change-room/backend/media/generated",
  "SELECT image_path AS filename FROM steps WHERE is_hearted=1 AND image_path IS NOT NULL");

await migrate("studio", "/root/studio-mariesvault/backend/studio.db",
  "/root/studio-mariesvault/backend/media/generated",
  "SELECT filename FROM generation_images WHERE is_hearted=1");

await migrate("choice", "/root/maries-choice/backend/maries-choice.db",
  "/root/maries-choice/backend/media/generated",
  "SELECT image_filename AS filename FROM story_nodes WHERE hearted=1 AND image_filename IS NOT NULL");
