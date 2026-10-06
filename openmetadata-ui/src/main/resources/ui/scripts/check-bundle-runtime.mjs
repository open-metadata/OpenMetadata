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

// Loads every route chunk of the production build in a fresh page and fails if
// any chunk it pulled in still exports `undefined`. That is how a chunking
// change breaks at runtime while the build stays green: a module the bundler
// wraps in a lazy initialiser ends up in a chunk whose importer never runs the
// initialiser (Explore once crashed with "py is not a function" this way).
// No backend is needed: the API is stubbed, and only module evaluation is
// checked.
import { chromium } from '@playwright/test';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Exports that are `undefined` in a healthy build, per chunk (name without
// hash). antd's bundle exports one binding that is never assigned.
const ALLOWED_UNDEFINED_EXPORTS = { 'vendor-antd': 1 };
const CONCURRENCY = 8;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(scriptDirectory, '../dist');
const bundleGraphPath = path.resolve(
  scriptDirectory,
  '../node_modules/.cache/bundle-graph.json'
);

if (process.env.PW_E2E_BUNDLE === 'true') {
  console.log('Bundle runtime check skipped for the Playwright bundle.');
  process.exit(0);
}
if (!existsSync(bundleGraphPath)) {
  throw new Error('Bundle graph report is missing. Run `yarn build` first.');
}
const { pages } = JSON.parse(readFileSync(bundleGraphPath, 'utf8'));
const indexHtml = readFileSync(path.join(distDirectory, 'index.html'), 'utf8')
  .replaceAll('${basePath}', '/')
  .replaceAll('${cspNonce}', '');
const contentTypes = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const server = createServer((request, response) => {
  const urlPath = decodeURIComponent(request.url.split('?')[0]);
  if (urlPath.startsWith('/api/')) {
    response.writeHead(503, { 'content-type': 'application/json' });
    response.end('{}');

    return;
  }
  const filePath = path.join(distDirectory, urlPath);
  if (
    !filePath.startsWith(distDirectory) ||
    !existsSync(filePath) ||
    statSync(filePath).isDirectory()
  ) {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(indexHtml);

    return;
  }
  response.writeHead(200, {
    'content-type':
      contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
});
await new Promise((resolve) => server.listen(0, resolve));
const origin = `http://localhost:${server.address().port}`;

const chunkName = (fileName) =>
  path.basename(fileName).replace(/-[\w-]{8}\.js$/, '');

const browser = await chromium.launch();
const failures = [];

const checkPage = async ({ module, file }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/signin`, { waitUntil: 'load' });
    const result = await page.evaluate(async (chunkUrl) => {
      try {
        await import(chunkUrl);
      } catch (error) {
        return { importError: String(error) };
      }
      const loaded = [
        ...new Set(
          performance
            .getEntriesByType('resource')
            .map(({ name }) => new URL(name).pathname)
            .filter((pathname) => pathname.endsWith('.js'))
        ),
      ];
      const undefinedExports = [];
      for (const pathname of loaded) {
        const namespace = await import(pathname);
        for (const key of Object.keys(namespace)) {
          if (namespace[key] === undefined) {
            undefinedExports.push([pathname, key]);
          }
        }
      }

      return { undefinedExports };
    }, `/${file}`);

    if (result.importError) {
      failures.push(`${module}: importing ${file} threw ${result.importError}`);

      return;
    }
    const perChunk = new Map();
    for (const [pathname, key] of result.undefinedExports) {
      const name = chunkName(pathname);
      perChunk.set(name, [...(perChunk.get(name) ?? []), key]);
    }
    for (const [name, keys] of perChunk) {
      if (keys.length > (ALLOWED_UNDEFINED_EXPORTS[name] ?? 0)) {
        failures.push(
          `${module}: ${name} exports ${
            keys.length
          } undefined binding(s) (${keys.join(', ')})`
        );
      }
    }
  } finally {
    await context.close();
  }
};

const queue = [...pages];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      await checkPage(queue.shift());
    }
  })
);
await browser.close();
server.close();

if (failures.length > 0) {
  throw new Error(
    `Bundle runtime check found ${
      failures.length
    } problem(s):\n  ${failures.join('\n  ')}`
  );
}
console.log(
  `Bundle runtime check passed: ${pages.length} route chunks load with no unexpected undefined exports.`
);
