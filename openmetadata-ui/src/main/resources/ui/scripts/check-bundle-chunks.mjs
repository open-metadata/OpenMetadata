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
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';

// Ratchets, not knife-edges: each carries a little headroom so one new dynamic import does not
// fail an unrelated PR, while still catching the fragmentation this budget exists to prevent.
//
// Rolldown emits at every dynamic-import boundary and does NOT run Rollup's
// `experimentalMinChunkSize` merger, so the natural chunk count is higher
// than Rollup's post-merge count. After narrowing the `import.meta.glob`
// patterns in ApplicationsClassBase and useImage — which had been over-matching
// hundreds of assets via bare `import(`../assets/...${var}`)` — the reference
// build sits at 1341 emitted / 1164 small (ui-core now ships one module per
// file, so its lazy-only components split per route). Headroom of ~15 % lets a few new
// lazy routes ship without a churn PR; a big regression still fails the gate.
const MAX_EMITTED_JS_FILES = 1400;
const MAX_SMALL_JS_FILES = 1250;
// Bumped 8 → 9 because sharing `oidcTokenStorage` between `silentCallbackEntry.ts`
// and the main app graph (see the silent-callback iframe fix on this PR) splits
// its subtree — plus `swTokenStorage` and `SwTokenStorageUtils` — into a shared
// chunk that both HTML entries reference via `<link modulepreload>`. That new
// chunk is <1 KB and byte-neutral; only the count went up by one.
const MAX_HTML_BOOTSTRAP_JS_FILES = 9;
// A ratchet, about 2 % above the reference build (902929 bytes). The old
// 1150 KiB ceiling sat ~120 KiB above the real size, which let an ~14 KiB
// regression (every icon moving onto the entry graph) through unnoticed. Lower
// it when the bootstrap shrinks; raising it means something new loads on every
// page, which scripts/bundle-boot-packages.json will also have flagged.
const MAX_HTML_BOOTSTRAP_JS_BROTLI_BYTES = 900 * 1024;
const MAX_SINGLE_JS_BYTES = 1.75 * 1024 * 1024;
const SMALL_JS_BYTES = 20 * 1024;
// First view of a route: the index.html bootstrap plus the route chunk and its
// static imports, Brotli. The two routes every session hits first.
const ROUTE_FIRST_VIEW_BROTLI_BYTES = {
  'src/pages/LoginPage/SignInPage.tsx': 930 * 1024,
  'src/pages/MyDataPage/MyDataPage.component.tsx': 1040 * 1024,
};
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
// Written by the `bundle-graph-report` plugin (vite/plugins.ts) during `yarn build`.
const bundleGraphPath = path.resolve(
  scriptDirectory,
  '../node_modules/.cache/bundle-graph.json'
);
// Every npm package the index.html bootstrap may contain. Generated from a
// build, then edited by hand: adding a package means it now loads on every
// page, so the reviewer should see why.
const bootPackagesPath = path.join(
  scriptDirectory,
  'bundle-boot-packages.json'
);
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
// Brotli-compress the ~8 bootstrap JS files in-memory rather than reading `.br`
// artifacts. The Vite build no longer runs brotli over every chunk (it added
// 1-3 minutes to every production build); the deployed server/CDN handles
// content-encoding at request time. This script still enforces the bootstrap
// budget because that number gates first-paint size.
const brotliBootstrapOptions = {
  params: {
    [zlibConstants.BROTLI_PARAM_QUALITY]: zlibConstants.BROTLI_MAX_QUALITY,
  },
};
const htmlBootstrapJsBrotliBytes = htmlBootstrapJsFiles.reduce(
  (totalBytes, fileName) => {
    const filePath = path.join(assetsDirectory, fileName);
    if (!existsSync(filePath)) {
      throw new Error(
        `Bundle budget cannot be checked because bootstrap file is missing: ${fileName}. Run \`yarn build\` to regenerate assets.`
      );
    }

    return (
      totalBytes +
      brotliCompressSync(readFileSync(filePath), brotliBootstrapOptions).length
    );
  },
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

if (!existsSync(bundleGraphPath)) {
  throw new Error(
    `Bundle graph report is missing (${bundleGraphPath}). Run \`yarn build\` first.`
  );
}
const bundleGraph = JSON.parse(readFileSync(bundleGraphPath, 'utf8'));
const allowedBootPackages = new Set(
  JSON.parse(readFileSync(bootPackagesPath, 'utf8'))
);
const bootPackages = Object.keys(bundleGraph.bootPackages);
for (const pkg of bootPackages.filter((p) => !allowedBootPackages.has(p))) {
  failures.push(
    `${pkg} is now loaded on every page, via ${bundleGraph.bootPackages[
      pkg
    ].join(
      ' → '
    )}. Import it from a lazy route instead, or add it to scripts/bundle-boot-packages.json if it belongs in the shell`
  );
}
for (const pkg of [...allowedBootPackages].filter(
  (p) => !bundleGraph.bootPackages[p]
)) {
  failures.push(
    `${pkg} is no longer in the bootstrap; remove it from scripts/bundle-boot-packages.json so it cannot come back unnoticed`
  );
}

const brotliCache = new Map();
const brotliSizeOf = (fileName) => {
  if (!brotliCache.has(fileName)) {
    brotliCache.set(
      fileName,
      brotliCompressSync(
        readFileSync(path.join(distDirectory, fileName)),
        brotliBootstrapOptions
      ).length
    );
  }

  return brotliCache.get(fileName);
};
const staticImportsOf = (fileName) =>
  [
    ...readFileSync(path.join(distDirectory, fileName), 'utf8').matchAll(
      /(?:import|export)\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+\.js)["']/g
    ),
  ].map(([, imported]) => `assets/${imported}`);
const bootFiles = new Set(bundleGraph.bootFiles);
for (const [route, budget] of Object.entries(ROUTE_FIRST_VIEW_BROTLI_BYTES)) {
  const page = bundleGraph.pages.find(({ module }) => module === route);
  if (!page) {
    failures.push(
      `${route} is no longer a lazy route chunk; update ROUTE_FIRST_VIEW_BROTLI_BYTES`
    );
    continue;
  }
  const files = new Set(bootFiles);
  const pending = [page.file];
  while (pending.length) {
    const fileName = pending.pop();
    if (
      !files.has(fileName) &&
      existsSync(path.join(distDirectory, fileName))
    ) {
      files.add(fileName);
      pending.push(...staticImportsOf(fileName));
    }
  }
  const bytes = [...files].reduce(
    (total, file) => total + brotliSizeOf(file),
    0
  );
  console.log(
    `First view of ${route}: ${bytes} Brotli bytes (budget ${budget}).`
  );
  if (bytes > budget) {
    failures.push(
      `first view of ${route} is ${bytes} Brotli bytes (maximum ${budget})`
    );
  }
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
