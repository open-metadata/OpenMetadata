#!/usr/bin/env node
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// Post-build brotli compressor for release artifacts.
//
// The Vite build no longer runs brotli in-process — `vite-plugin-compression`
// was single-threaded through Rollup's `writeBundle` and added 1–3 min to
// every build. This script does the same work, in parallel, as a separate
// step: for every `dist/**` asset the deployed `OpenMetadataAssetServlet`
// would try to serve as `.br` (JS, CSS, HTML, SVG, JSON, WASM), write a
// sibling `<file>.br` compressed at max quality.
//
// Skip logic (matches the old plugin exactly so behaviour is unchanged
// end-to-end):
//   - files smaller than 1024 bytes (bigger overhead than payload)
//   - already-compressed sibling extensions (.br, .gz, images, fonts)
//   - a `.br` that already exists AND is newer than its source
//
// Concurrency defaults to `os.availableParallelism()` (physical cores). On a
// 2-vCPU CI runner that's 2 concurrent quality-11 compressions; on an
// 8-core dev laptop it's 8. `BROTLI_CONCURRENCY=N` overrides.

import {
  readdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompress, constants as zlibConstants } from 'node:zlib';
import { promisify } from 'node:util';

const brotliCompressAsync = promisify(brotliCompress);

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(scriptDirectory, '../dist');

const MIN_BYTES = 1024;
const COMPRESSIBLE_EXT = /\.(js|mjs|css|html|svg|json|wasm)$/i;
// `Number(env || fallback)` misbehaves on two edge cases: `BROTLI_CONCURRENCY=0`
// stays 0 (non-empty string is truthy, so `||` doesn't fall through), and a
// non-numeric value coerces to NaN. Both end with a zero-worker pool and a
// crash in the summary `reduce` on `undefined.source`. Clamp to ≥ 1 by moving
// `Number()` inside the `||` chain so 0/NaN fall through to the fallback.
const CONCURRENCY = Math.max(
  1,
  Math.floor(
    Number(process.env.BROTLI_CONCURRENCY) || os.availableParallelism?.() || 2
  )
);
const QUALITY = zlibConstants.BROTLI_MAX_QUALITY;

if (!existsSync(distDirectory)) {
  console.error(
    `[compress-brotli] dist directory not found at ${distDirectory}. Run \`yarn build\` first.`
  );
  process.exit(1);
}

async function walkFiles(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }

  return out;
}

async function shouldCompress(filePath) {
  const name = path.basename(filePath);
  if (name.endsWith('.br') || name.endsWith('.gz')) {
    return false;
  }
  if (!COMPRESSIBLE_EXT.test(name)) {
    return false;
  }
  const stats = await stat(filePath);
  if (stats.size < MIN_BYTES) {
    return false;
  }
  const brPath = `${filePath}.br`;
  if (existsSync(brPath)) {
    const brStats = await stat(brPath);
    if (brStats.mtimeMs >= stats.mtimeMs) {
      return false;
    }
  }

  return true;
}

async function compressOne(filePath) {
  const source = await readFile(filePath);
  const compressed = await brotliCompressAsync(source, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: QUALITY,
      // Hinting the input size lets the encoder pick better window/block
      // parameters — small but free compression-ratio win.
      [zlibConstants.BROTLI_PARAM_SIZE_HINT]: source.length,
    },
  });
  await writeFile(`${filePath}.br`, compressed);

  return { path: filePath, source: source.length, out: compressed.length };
}

async function runPool(tasks, concurrency) {
  const results = new Array(tasks.length);
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) {
        return;
      }
      results[index] = await tasks[index]();
    }
  });
  await Promise.all(workers);

  return results;
}

const started = Date.now();
const allFiles = await walkFiles(distDirectory);
const candidates = [];
for (const file of allFiles) {
  if (await shouldCompress(file)) {
    candidates.push(file);
  }
}

if (candidates.length === 0) {
  console.log('[compress-brotli] Nothing to compress; every eligible file already has a fresh .br sibling.');
  process.exit(0);
}

console.log(
  `[compress-brotli] Compressing ${candidates.length} files with quality ${QUALITY} on ${CONCURRENCY} workers…`
);

const results = await runPool(
  candidates.map((file) => () => compressOne(file)),
  CONCURRENCY
);

const totalIn = results.reduce((sum, r) => sum + r.source, 0);
const totalOut = results.reduce((sum, r) => sum + r.out, 0);
const ratio = totalIn === 0 ? 0 : ((1 - totalOut / totalIn) * 100).toFixed(1);
const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);

console.log(
  `[compress-brotli] Wrote ${results.length} .br files: ${(totalIn / 1024 / 1024).toFixed(1)} MiB → ${(totalOut / 1024 / 1024).toFixed(1)} MiB (${ratio}% smaller) in ${elapsedSec}s.`
);
