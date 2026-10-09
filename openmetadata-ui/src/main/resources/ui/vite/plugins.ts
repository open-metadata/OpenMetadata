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
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

const UI_ROOT = path.resolve(__dirname, '..');

export const BUNDLE_GRAPH_REPORT = path.join(
  UI_ROOT,
  'node_modules/.cache/bundle-graph.json'
);

/**
 * Vite plugin: capture hashed asset filenames at bundle time and inject
 * <link rel="preload"> tags into index.html so the browser discovers the
 * Inter variable font and the landing-page hero SVG before the JS bundle
 * executes.  `transformIndexHtml: { order: 'post' }` ensures this hook runs
 * after the existing `html-transform` plugin (which adds `${basePath}`
 * prefixes), so we write `${basePath}` directly into the href and let the
 * Java backend replace it at runtime — exactly the same mechanism used for
 * script/link/image tags elsewhere.
 */
export const injectCriticalPreloads = (): Plugin => {
  let fontPath = '';
  let heroPath = '';

  return {
    name: 'inject-critical-preloads',
    generateBundle(_opts, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset') {
          continue;
        }
        if (
          file.fileName?.includes('inter-latin-wght-normal') &&
          file.fileName.endsWith('.woff2')
        ) {
          fontPath = file.fileName;
        }
        if (
          file.fileName?.includes('landing-page-header-bg') &&
          file.fileName.endsWith('.svg')
        ) {
          heroPath = file.fileName;
        }
      }
    },
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string) {
        const tags: string[] = [];
        if (fontPath) {
          tags.push(
            `<link rel="preload" as="font" type="font/woff2" crossorigin href="\${basePath}${fontPath}">`
          );
        }
        if (heroPath) {
          tags.push(
            `<link rel="preload" as="image" fetchpriority="high" href="\${basePath}${heroPath}">`
          );
        }

        return tags.length
          ? html.replace('</head>', `  ${tags.join('\n    ')}\n  </head>`)
          : html;
      },
    },
  };
};

const TS_ENUM_IIFE = /\(function\([\w$]+\)\{return [^{}]*\}\)\(\{\}\)/g;

/**
 * Fails the build when a chunk holds nothing but TS enum objects. That means an
 * enum module escaped the `app-enums` group: it imports something, or it does
 * not follow the *.enum.ts / *.interface.ts / types.ts / src/enums convention.
 * Fix the module; do not add an allowlist.
 */
export const noEnumOnlyChunks = (): Plugin => ({
  name: 'no-enum-only-chunks',
  generateBundle(_opts, bundle) {
    const offenders = Object.values(bundle).flatMap((chunk) => {
      if (chunk.type !== 'chunk' || !chunk.code.match(TS_ENUM_IIFE)) {
        return [];
      }
      const rest = chunk.code
        .replace(/\/\/# sourceMappingURL=.*$/m, '')
        .replace(/import(\{[^}]*\}from)?"[^"]+";/g, '')
        .replace(/export\{[^}]*\}(from"[^"]+")?;?/g, '')
        .replace(TS_ENUM_IIFE, '')
        .replace(/(let|var|const)\s|[\w$]+=|[,;\s]/g, '');

      return rest
        ? []
        : [
            `${chunk.fileName} <- ${chunk.moduleIds
              .map((id) => path.relative(UI_ROOT, id))
              .join(', ')}`,
          ];
    });

    if (offenders.length) {
      this.error(
        `Enum-only chunks emitted; make the enum module import-free and name it *.enum.ts / *.interface.ts / types.ts:\n  ${offenders.join(
          '\n  '
        )}`
      );
    }
  },
});

export const htmlBasePathTransform = (): Plugin => ({
  name: 'html-transform',
  transformIndexHtml(html: string) {
    // Don't replace ${basePath} placeholder - it will be replaced at runtime by Java backend
    // Add ${basePath} prefix to asset paths (with or without leading slash)
    return html
      .replaceAll(
        /(<script[^>]*src=["'])(\.\/)?assets\//g,
        '$1${basePath}assets/'
      )
      .replaceAll(
        /(<link[^>]*href=["'])(\.\/)?assets\//g,
        '$1${basePath}assets/'
      )
      .replaceAll(/(<img[^>]*src=["'])(\.\/)?assets\//g, '$1${basePath}assets/')
      .replaceAll(
        /(<img[^>]*src=["'])(\.\/)?images\//g,
        '$1${basePath}images/'
      );
  },
});

const packageOf = (id: string) => {
  const nodeModulesPath = id.split('/node_modules/').slice(1).pop();
  if (!nodeModulesPath) {
    return undefined;
  }
  const [scopeOrName, scopedName] = nodeModulesPath.split('/');

  return scopeOrName.startsWith('@')
    ? `${scopeOrName}/${scopedName}`
    : scopeOrName;
};

const relativeId = (id: string) => {
  const pkg = packageOf(id);

  return pkg ?? path.relative(UI_ROOT, id);
};

/**
 * Writes what the index.html entry loads at startup (files, and every npm
 * package in them with the import chain that brought it in) plus each page
 * chunk, for `yarn bundle:check` and `yarn bundle:runtime`. Kept outside dist
 * so it never ships.
 */
export const bundleGraphReport = (): Plugin => ({
  name: 'bundle-graph-report',
  generateBundle(_opts, bundle) {
    const chunks = Object.values(bundle).flatMap((file) =>
      file.type === 'chunk' ? [file] : []
    );
    const byFileName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
    const entry = chunks.find(
      (chunk) => chunk.isEntry && chunk.facadeModuleId?.endsWith('/index.html')
    );
    if (!entry?.facadeModuleId) {
      this.error('bundle-graph-report: no chunk for the index.html entry');
    }
    const entryId = entry.facadeModuleId;

    const bootFiles = new Set<string>();
    const pending = [entry.fileName];
    while (pending.length) {
      const fileName = pending.pop() as string;
      if (!bootFiles.has(fileName)) {
        bootFiles.add(fileName);
        pending.push(...(byFileName.get(fileName)?.imports ?? []));
      }
    }

    // Shortest chain of static imports from the entry to `id`, collapsed to
    // one step per package so the reader sees which app file pulled it in.
    const importChain = (id: string) => {
      const parent = new Map<string, string>([[id, '']]);
      const queue = [id];
      while (queue.length && !parent.has(entryId)) {
        const current = queue.shift() as string;
        for (const importer of this.getModuleInfo(current)?.importers ?? []) {
          if (!parent.has(importer)) {
            parent.set(importer, current);
            queue.push(importer);
          }
        }
      }
      const chain: string[] = [];
      for (let node = entryId; node; node = parent.get(node) ?? '') {
        const step = relativeId(node);
        if (chain[chain.length - 1] !== step) {
          chain.push(step);
        }
        if (node === id) {
          break;
        }
      }

      return chain;
    };

    const bootPackages: Record<string, string[]> = {};
    for (const fileName of bootFiles) {
      for (const id of byFileName.get(fileName)?.moduleIds ?? []) {
        const pkg = id.startsWith('\0') ? undefined : packageOf(id);
        if (pkg && !bootPackages[pkg]) {
          bootPackages[pkg] = importChain(id);
        }
      }
    }

    const pages = chunks
      .filter(
        (chunk) =>
          chunk.isDynamicEntry && chunk.facadeModuleId?.includes('/src/pages/')
      )
      .map((chunk) => ({
        module: relativeId(chunk.facadeModuleId as string),
        file: chunk.fileName,
      }))
      .sort((a, b) => a.module.localeCompare(b.module));

    mkdirSync(path.dirname(BUNDLE_GRAPH_REPORT), { recursive: true });
    writeFileSync(
      BUNDLE_GRAPH_REPORT,
      JSON.stringify(
        {
          entry: entry.fileName,
          bootFiles: [...bootFiles],
          bootPackages,
          pages,
        },
        null,
        2
      )
    );
  },
});
