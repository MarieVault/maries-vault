#!/usr/bin/env node
/**
 * Import TSF Closet generated images into Marie's Vault gallery.
 * Run once to import existing, or with --watch to auto-import new ones.
 * Images served at /uploads/tsf-closet/<filename>
 */

import { createRequire } from "module";
import { readFileSync, readdirSync, statSync, watchFile } from "fs";
import { join, basename } from "path";
import pg from "pg";

const require = createRequire(import.meta.url);
const IMAGES_DIR = "/srv/tsf-closet/shared/data/history_images";
const USER_ID = 7; // Mark's Marie's Vault user_id
const DB_URL = "postgresql://mariesvault:vault123@localhost:5432/mariesvault";
const WATCH_MODE = process.argv.includes("--watch");

const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

// Get already-imported filenames
const { rows: existing } = await client.query(
  "SELECT image_url FROM entries WHERE artist = 'TSF Closet'"
);
const importedUrls = new Set(existing.map(r => r.image_url));
console.log(`Already imported: ${importedUrls.size} images`);

async function importFile(filename) {
  const imageUrl = `/uploads/tsf-closet/${filename}`;
  if (importedUrls.has(imageUrl)) return false;

  const title = `TSF Closet — ${filename.slice(0, 8)}`;
  await client.query(
    `INSERT INTO entries (title, image_url, type, artist, tags, user_id, created_at)
     VALUES ($1, $2, 'image', 'TSF Closet', ARRAY['tsf-closet', 'ai-generated'], $3, NOW())`,
    [title, imageUrl, USER_ID]
  );
  importedUrls.add(imageUrl);
  console.log(`Imported: ${filename}`);
  return true;
}

// Import all existing
const files = readdirSync(IMAGES_DIR).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));
let imported = 0;
for (const file of files) {
  if (await importFile(file)) imported++;
}
console.log(`\nDone! Imported ${imported} new images (${files.length} total in folder)`);

if (WATCH_MODE) {
  console.log("\nWatching for new images...");
  // Poll every 30s for new files
  setInterval(async () => {
    const current = readdirSync(IMAGES_DIR).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));
    for (const file of current) {
      await importFile(file);
    }
  }, 30000);
} else {
  await client.end();
}
