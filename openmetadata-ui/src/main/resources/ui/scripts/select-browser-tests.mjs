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

/**
 * Picks the browser test files a change affects.
 *
 *   node scripts/select-browser-tests.mjs --map impact-map.json --base <sha> [--out selection.json]
 *
 * The impact map ({ testFile: [source files it executed] }) comes from main's
 * full run with BROWSER_IMPACT_DIR set (src/test/browser/impact.ts). The static
 * import graph is too entangled to select from on its own (lazy imports tie
 * ~1,000 modules into one cycle; openmetadata-collate#7947), so it is used only
 * for what coverage cannot see: test helpers, the direct imports of executed
 * files (constants, styles, assets) and stylesheets nothing imports.
 * Anything this cannot reason about runs the whole suite.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI = 'openmetadata-ui/src/main/resources/ui/';
const LOCALE = 'src/locale/languages/en-us.json';

/** Repo-root paths whose change can affect every browser test. */
const RUN_ALL_PREFIXES = [
  'openmetadata-ui-core-components/',
  '.github/workflows/ui-browser-tests.yml',
  '.github/actions/ui-browser-setup/',
  `${UI}package.json`,
  `${UI}yarn.lock`,
  `${UI}.nvmrc`,
  `${UI}tsconfig`,
  `${UI}vite.config.ts`,
  `${UI}vitest.browser.config.ts`,
  `${UI}scripts/select-browser-tests.mjs`,
];

/** Core-components files that never ship in its bundle. */
const isCoreDevOnly = (file) =>
  file.startsWith('openmetadata-ui-core-components/') &&
  /(\.(test|spec|stories)\.[jt]sx?|\.mdx?)$/.test(file);

const isTestSide = (file) =>
  file.startsWith('src/test/') || /\.browser\.test\.tsx?$/.test(file);

/** Translation keys whose value changed, was added or was removed. */
export const changedKeys = (before, after) => {
  const flat = (obj, prefix = '') =>
    Object.entries(obj).flatMap(([key, value]) =>
      value && typeof value === 'object'
        ? flat(value, `${prefix}${key}.`)
        : [[`${prefix}${key}`, value]]
    );
  const a = new Map(flat(before));
  const b = new Map(flat(after));
  // Code names `label.count`; i18next adds the plural suffix.
  const base = (key) => key.replace(/_(zero|one|two|few|many|other)$/, '');

  return [
    ...new Set(
      [...new Set([...a.keys(), ...b.keys()])]
        .filter((key) => a.get(key) !== b.get(key))
        .map(base)
    ),
  ];
};

/**
 * @param {object} input
 * @param {string[]} input.changed repo-root paths changed by the PR
 * @param {string[]} input.tests UI-relative browser test files in the tree
 * @param {Record<string, string[]> | undefined} input.map impact map
 * @param {Record<string, {path: string, dynamic: boolean}[]> | undefined} input.graph
 *   UI-relative import graph, undefined when it could not be built
 * @param {string[]} [input.keys] translation keys changed in en-us.json
 * @param {(file: string) => string} [input.read] reads a UI-relative file
 * @param {(text: string) => boolean} [input.inCode] whether any UI or core
 *   .ts/.tsx file contains `text` literally (default: no, which runs all)
 */
export const selectTests = ({
  changed,
  tests,
  map,
  graph,
  keys = [],
  read = () => '',
  inCode = () => false,
}) => {
  const all = (reason) => ({ mode: 'all', reason, tests, uncovered: [] });
  // ponytail: core ships as a bundle coverage cannot attribute, so any
  // shipped core change runs everything; map core's source once browser tests
  // run against it.
  const trigger = changed.find(
    (file) =>
      !isCoreDevOnly(file) &&
      RUN_ALL_PREFIXES.some((prefix) => file.startsWith(prefix))
  );
  if (trigger) {
    return all(`${trigger} affects every browser test`);
  }
  if (!map) {
    return all('no impact map from main yet');
  }
  if (!graph) {
    return all('the import graph could not be built');
  }

  const imports = (file) => graph[file] ?? [];
  const directImports = (file) =>
    imports(file)
      .filter((edge) => !edge.dynamic)
      .map((edge) => edge.path);

  // Test helpers a test file reaches, then the product files they and the
  // executed files import directly.
  const footprint = new Map(
    tests.map((test) => {
      const helpers = new Set([test]);
      const queue = [test];
      while (queue.length) {
        for (const { path } of imports(queue.pop())) {
          if (isTestSide(path) && !helpers.has(path)) {
            helpers.add(path);
            queue.push(path);
          }
        }
      }
      const files = new Set([...helpers, ...(map[test] ?? [])]);
      for (const file of [...files]) {
        directImports(file).forEach((path) => files.add(path));
      }

      return [test, files];
    })
  );
  const reaching = (file) =>
    tests.filter((test) => footprint.get(test).has(file));

  const selected = new Set(tests.filter((test) => !map[test]));
  const uncovered = [];
  const imported = new Set(
    Object.values(graph)
      .flat()
      .map((e) => e.path)
  );

  for (const path of changed.filter((file) => file.startsWith(UI))) {
    const file = path.slice(UI.length);
    if (!file.startsWith('src/') || file.startsWith('src/locale/')) {
      continue;
    }
    const hits = reaching(file);
    if (hits.length) {
      hits.forEach((test) => selected.add(test));
    } else if (isTestSide(file) && !tests.includes(file)) {
      // Setup files and helpers no test imports (setup.ts, msw.ts).
      return all(`${file} is browser-test setup`);
    } else if (
      /\.(less|css)$/.test(file) &&
      !imported.has(file) &&
      !inCode(file.split('/').pop())
    ) {
      // Only reached through another stylesheet's @import.
      return all(`${file} is a global stylesheet`);
    } else if (!isTestSide(file)) {
      uncovered.push(file);
    }
  }

  if (changed.includes(`${UI}${LOCALE}`) && keys.length) {
    const found = new Set();
    for (const test of tests) {
      const source = [...footprint.get(test)].map(read).join('\n');
      const used = keys.filter((key) => source.includes(key));
      used.forEach((key) => found.add(key));
      if (used.length) {
        selected.add(test);
      }
    }
    // A key no source file names literally is built at runtime
    // (`t(\`label.${x}\`)`), so any test may render it.
    if (keys.some((key) => !found.has(key) && !inCode(key))) {
      return all('changed translation keys not found in any test footprint');
    }
  }

  const picked = tests.filter((test) => selected.has(test));

  return {
    mode: picked.length ? 'selected' : 'none',
    reason: picked.length
      ? `${picked.length} of ${tests.length} test files execute the changed code`
      : 'no browser test executes the changed code',
    tests: picked,
    uncovered,
  };
};

/** UI-relative import graph of everything the browser tests reach. */
const buildGraph = async (tests) => {
  // CI's select job installs only esbuild and points here; locally it
  // resolves from node_modules.
  const { build } = await import(process.env.ESBUILD_PATH ?? 'esbuild');
  const outdir = join(tmpdir(), `browser-graph-${process.pid}`);
  const empty = Object.fromEntries(
    [
      '.svg',
      '.png',
      '.jpg',
      '.gif',
      '.webp',
      '.mp4',
      '.woff',
      '.woff2',
      '.ttf',
      '.less',
      '.css',
      '.md',
    ].map((ext) => [ext, 'empty'])
  );
  try {
    const { metafile } = await build({
      entryPoints: tests,
      bundle: true,
      splitting: true,
      format: 'esm',
      outdir,
      metafile: true,
      packages: 'external',
      logLevel: 'silent',
      tsconfig: 'tsconfig.json',
      loader: empty,
    });

    return Object.fromEntries(
      Object.entries(metafile.inputs).map(([file, input]) => [
        file,
        input.imports
          .filter((edge) => !edge.external)
          .map((edge) => ({
            path: edge.path,
            dynamic: edge.kind === 'dynamic-import',
          })),
      ])
    );
  } catch {
    return undefined;
  } finally {
    rmSync(outdir, { recursive: true, force: true });
  }
};

const main = async () => {
  const args = process.argv.slice(2);
  const option = (name) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const base = option('--base');
  // --head replays one commit (`--base <sha>~1 --head <sha>`).
  const head = option('--head') ?? 'HEAD';
  const git = (...cmd) =>
    execFileSync('git', cmd, { encoding: 'utf8', maxBuffer: 1 << 26 });
  // Deletions are left out: a deleted test needs no run, and a deleted
  // source file's importers change with it.
  const changed = git(
    'diff',
    '--name-only',
    '--diff-filter=d',
    `${base}...${head}`
  )
    .split('\n')
    .filter(Boolean);
  const tests = git(
    'ls-files',
    'src/*.browser.test.ts',
    'src/*.browser.test.tsx'
  )
    .split('\n')
    .filter(Boolean);
  const mapFile = option('--map');
  const map =
    mapFile && existsSync(mapFile)
      ? JSON.parse(readFileSync(mapFile, 'utf8'))
      : undefined;
  let keys = [];
  if (changed.includes(`${UI}${LOCALE}`)) {
    const before = git('show', `${base}:${UI}${LOCALE}`);
    const after =
      head === 'HEAD'
        ? readFileSync(LOCALE, 'utf8')
        : git('show', `${head}:${UI}${LOCALE}`);
    keys = changedKeys(JSON.parse(before), JSON.parse(after));
  }
  const inCode = (text) => {
    try {
      const core =
        ':/openmetadata-ui-core-components/src/main/resources/ui/src';
      git(
        'grep',
        '-q',
        '-F',
        text,
        '--',
        'src/*.ts',
        'src/*.tsx',
        `${core}/*.ts`,
        `${core}/*.tsx`
      );

      return true;
    } catch {
      return false;
    }
  };
  const read = (file) =>
    /\.[jt]sx?$/.test(file) && existsSync(file)
      ? readFileSync(file, 'utf8')
      : '';

  const result = selectTests({
    changed,
    tests,
    map,
    graph: map ? await buildGraph(tests) : undefined,
    keys,
    read,
    inCode,
  });
  const out = option('--out');
  if (out) {
    writeFileSync(out, JSON.stringify(result, null, 2));
  }
  process.stdout.write(
    `${result.mode}: ${result.reason}\n${result.tests.join('\n')}\n` +
      (result.uncovered.length
        ? `\nChanged code no browser test executes:\n${result.uncovered.join(
            '\n'
          )}\n`
        : '')
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
