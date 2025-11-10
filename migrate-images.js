#!/usr/bin/env node

/**
 * Migration Script: Convert Base64 Images to Files
 *
 * This script converts all base64-encoded images stored in the database
 * to actual image files on disk, then updates the database with file paths.
 */

import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql as sqlOp } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { customEntries } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mariesvault:vault123@localhost:5432/mariesvault';
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

// Uploads directory
const uploadsDir = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Extracts image data from base64 data URL
 * @param {string} dataUrl - Base64 data URL (e.g., "data:image/jpeg;base64,...")
 * @returns {{buffer: Buffer, extension: string, mimeType: string} | null}
 */
function parseBase64Image(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return null;
  }

  try {
    // Extract mime type and base64 data
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return null;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    // Get file extension from mime type
    const extensionMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    };

    const extension = extensionMap[mimeType] || '.jpg';

    // Decode base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    return { buffer, extension, mimeType };
  } catch (error) {
    console.error('Error parsing base64 image:', error);
    return null;
  }
}

/**
 * Main migration function
 */
async function migrateImages() {
  console.log('🔄 Starting image migration...\n');

  try {
    // Fetch all custom entries with base64 images
    console.log('📊 Fetching custom entries with base64 images...');
    const entries = await db
      .select()
      .from(customEntries)
      .where(sqlOp`custom_image_url IS NOT NULL AND custom_image_url LIKE 'data:%'`);

    console.log(`Found ${entries.length} entries with base64 images\n`);

    if (entries.length === 0) {
      console.log('✅ No base64 images to migrate!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let totalSizeSaved = 0;

    // Process each entry
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      console.log(`[${i + 1}/${entries.length}] Processing entry ID: ${entry.id}`);

      try {
        // Parse base64 image
        const imageData = parseBase64Image(entry.customImageUrl);
        if (!imageData) {
          console.log(`  ⚠️  Invalid base64 data, skipping`);
          errorCount++;
          continue;
        }

        const { buffer, extension } = imageData;
        const originalSize = entry.customImageUrl.length;
        const fileSize = buffer.length;

        // Generate unique filename
        const filename = `migrated-entry-${entry.id}-${Date.now()}${extension}`;
        const filePath = path.join(uploadsDir, filename);

        // Save image to disk
        fs.writeFileSync(filePath, buffer);

        // Update database with new file path
        const newImageUrl = `/uploads/${filename}`;
        await db
          .update(customEntries)
          .set({ customImageUrl: newImageUrl })
          .where(eq(customEntries.id, entry.id));

        totalSizeSaved += originalSize - newImageUrl.length;
        successCount++;

        console.log(`  ✅ Saved: ${filename} (${(fileSize / 1024).toFixed(1)} KB)`);
        console.log(`  💾 Database size reduced by ${(originalSize / 1024).toFixed(1)} KB`);
      } catch (error) {
        console.error(`  ❌ Error processing entry ${entry.id}:`, error.message);
        errorCount++;
      }

      console.log('');
    }

    // Summary
    console.log('=' .repeat(60));
    console.log('📈 Migration Summary:');
    console.log('=' .repeat(60));
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`💾 Total database size reduced: ${(totalSizeSaved / 1024 / 1024).toFixed(2)} MB`);
    console.log('=' .repeat(60));

    if (successCount > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('  1. Restart your server');
      console.log('  2. Test image loading');
      console.log('  3. Verify performance improvements');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
migrateImages().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
