#!/usr/bin/env node
/**
 * Downloads face-api.js model weight files from the official GitHub repo
 * and places them in src/assets/models/ ready for the Angular dev server.
 *
 * Usage:  node scripts/download-models.mjs
 * Or:     npm run download-models
 */

import { createWriteStream, mkdirSync } from 'fs';
import { get } from 'https';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, '..', 'src', 'assets', 'models');
const BASE_URL  = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

mkdirSync(OUT_DIR, { recursive: true });

const FILES = [
  // SSD MobileNet (face detection)
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  // Face Landmarks 68
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  // Face Recognition
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

function download(filename) {
  return new Promise((resolve, reject) => {
    const url  = `${BASE_URL}/${filename}`;
    const dest = join(OUT_DIR, filename);
    process.stdout.write(`  ↓ ${filename} … `);
    get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const file = createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(); console.log('done'); resolve(); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

console.log(`\nDownloading face-api.js models → ${OUT_DIR}\n`);

(async () => {
  for (const f of FILES) {
    await download(f);
  }
  console.log('\n✅  All models downloaded successfully.\n');
})().catch(err => {
  console.error('\n❌  Download failed:', err.message);
  process.exit(1);
});
