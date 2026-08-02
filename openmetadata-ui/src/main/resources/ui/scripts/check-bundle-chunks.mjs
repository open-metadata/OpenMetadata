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

const MAX_EMITTED_JS_FILES = 650;
const MAX_INITIAL_JS_REQUESTS = 40;
const MAX_INITIAL_JS_BROTLI_BYTES = 1024 * 1024;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(scriptDirectory, '../dist');
const assetsDirectory = path.join(distDirectory, 'assets');
const indexPath = path.join(distDirectory, 'index.html');

if (!existsSync(assetsDirectory) || !existsSync(indexPath)) {
  throw new Error('Bundle assets are missing. Run `yarn build` first.');
}

const assetNames = readdirSync(assetsDirectory);
const jsFiles = assetNames.filter((fileName) => fileName.endsWith('.js'));
const indexHtml = readFileSync(indexPath, 'utf8');
const initialJsFiles = [
  ...new Set(
    [...indexHtml.matchAll(/assets\/([^"']+\.js)/g)].map(
      ([, fileName]) => fileName
    )
  ),
];
const initialJsRequests = initialJsFiles.length;
const initialJsBrotliBytes = initialJsFiles.reduce((totalBytes, fileName) => {
  const jsPath = path.join(assetsDirectory, fileName);
  const brotliPath = `${jsPath}.br`;

  return (
    totalBytes + statSync(existsSync(brotliPath) ? brotliPath : jsPath).size
  );
}, 0);

const failures = [];

if (jsFiles.length > MAX_EMITTED_JS_FILES) {
  failures.push(
    `emitted ${jsFiles.length} JavaScript files (maximum ${MAX_EMITTED_JS_FILES})`
  );
}
if (initialJsRequests > MAX_INITIAL_JS_REQUESTS) {
  failures.push(
    `requires ${initialJsRequests} initial JavaScript requests (maximum ${MAX_INITIAL_JS_REQUESTS})`
  );
}
if (initialJsBrotliBytes > MAX_INITIAL_JS_BROTLI_BYTES) {
  failures.push(
    `initial JavaScript is ${initialJsBrotliBytes} Brotli bytes (maximum ${MAX_INITIAL_JS_BROTLI_BYTES})`
  );
}

if (failures.length > 0) {
  throw new Error(`Bundle budget exceeded: ${failures.join('; ')}.`);
}

console.log(
  `Bundle budget passed: ${jsFiles.length} emitted JS files, ${initialJsRequests} initial JS requests, ${initialJsBrotliBytes} initial Brotli bytes.`
);
