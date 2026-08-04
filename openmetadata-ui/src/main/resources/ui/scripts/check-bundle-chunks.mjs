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

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Ratchets, not knife-edges: each carries a little headroom so one new dynamic import does not
// fail an unrelated PR, while still catching the fragmentation this budget exists to prevent
// (the pre-consolidation build emitted 856 files).
const MAX_EMITTED_JS_FILES = 645;
const MAX_SMALL_JS_FILES = 460;
const MAX_HTML_BOOTSTRAP_JS_FILES = 8;
const MAX_HTML_BOOTSTRAP_JS_BROTLI_BYTES = 950 * 1024;
const MAX_SINGLE_JS_BYTES = 1.75 * 1024 * 1024;
const SMALL_JS_BYTES = 20 * 1024;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(scriptDirectory, '../dist');
const assetsDirectory = path.join(distDirectory, 'assets');
const indexPath = path.join(distDirectory, 'index.html');

if (process.env.PW_E2E_BUNDLE === 'true') {
  console.log(
    'Bundle budget skipped for the separately measured coarse Playwright bundle.'
  );
  process.exit(0);
}

if (!existsSync(assetsDirectory) || !existsSync(indexPath)) {
  throw new Error('Bundle assets are missing. Run `yarn build` first.');
}

const assetNames = readdirSync(assetsDirectory);
const jsFiles = assetNames.filter((fileName) => fileName.endsWith('.js'));
const jsFileSizes = jsFiles.map((fileName) => ({
  fileName,
  size: statSync(path.join(assetsDirectory, fileName)).size,
}));
const smallJsFiles = jsFileSizes.filter(({ size }) => size < SMALL_JS_BYTES);
const largestJsFile = jsFileSizes.reduce((largestFile, currentFile) =>
  currentFile.size > largestFile.size ? currentFile : largestFile
);
const indexHtml = readFileSync(indexPath, 'utf8');
const htmlBootstrapJsFiles = [
  ...new Set(
    [...indexHtml.matchAll(/assets\/([^"']+\.js)/g)].map(
      ([, fileName]) => fileName
    )
  ),
];
const htmlBootstrapJsBrotliFiles = htmlBootstrapJsFiles.map(
  (fileName) => `${fileName}.br`
);
const missingHtmlBootstrapJsBrotliFiles = htmlBootstrapJsBrotliFiles.filter(
  (fileName) => !existsSync(path.join(assetsDirectory, fileName))
);

if (missingHtmlBootstrapJsBrotliFiles.length > 0) {
  throw new Error(
    `Bundle budget cannot be checked because Brotli artifacts are missing: ${missingHtmlBootstrapJsBrotliFiles.join(
      ', '
    )}. Run \`yarn build\` to regenerate compressed assets.`
  );
}

const htmlBootstrapJsBrotliBytes = htmlBootstrapJsBrotliFiles.reduce(
  (totalBytes, fileName) =>
    totalBytes + statSync(path.join(assetsDirectory, fileName)).size,
  0
);

const failures = [];

if (jsFiles.length > MAX_EMITTED_JS_FILES) {
  failures.push(
    `emitted ${jsFiles.length} JavaScript files (maximum ${MAX_EMITTED_JS_FILES})`
  );
}
if (smallJsFiles.length > MAX_SMALL_JS_FILES) {
  failures.push(
    `emitted ${smallJsFiles.length} JavaScript files below 20 KiB (maximum ${MAX_SMALL_JS_FILES})`
  );
}
if (htmlBootstrapJsFiles.length > MAX_HTML_BOOTSTRAP_JS_FILES) {
  failures.push(
    `index.html references ${htmlBootstrapJsFiles.length} JavaScript files (maximum ${MAX_HTML_BOOTSTRAP_JS_FILES})`
  );
}
if (htmlBootstrapJsBrotliBytes > MAX_HTML_BOOTSTRAP_JS_BROTLI_BYTES) {
  failures.push(
    `index.html JavaScript is ${htmlBootstrapJsBrotliBytes} Brotli bytes (maximum ${MAX_HTML_BOOTSTRAP_JS_BROTLI_BYTES})`
  );
}
if (largestJsFile.size > MAX_SINGLE_JS_BYTES) {
  failures.push(
    `${largestJsFile.fileName} is ${largestJsFile.size} bytes (maximum ${MAX_SINGLE_JS_BYTES})`
  );
}

if (failures.length > 0) {
  throw new Error(`Bundle budget exceeded: ${failures.join('; ')}.`);
}

console.log(
  `Bundle budget passed: ${jsFiles.length} emitted JS files, ${smallJsFiles.length} below 20 KiB, ${htmlBootstrapJsFiles.length} referenced by index.html, ${htmlBootstrapJsBrotliBytes} bootstrap Brotli bytes, largest chunk ${largestJsFile.fileName} at ${largestJsFile.size} bytes.`
);
console.log(
  'Authenticated runtime requests remain enforced by the Playwright request summarizer.'
);
