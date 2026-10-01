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
import path from 'path';
import type { Plugin } from 'vite';

const UI_ROOT = path.resolve(__dirname, '..');

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
