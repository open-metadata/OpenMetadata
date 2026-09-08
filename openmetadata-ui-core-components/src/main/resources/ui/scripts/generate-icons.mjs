/*
 *  Copyright 2025 Collate.
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
 * generate-icons.mjs
 *
 * Converts SVG files into TypeScript React components in src/icons/.
 *
 * Usage:
 *   yarn icons:generate
 *
 * Two source folders, same output, same import path:
 *
 *   icons/         → regular icons: width/height removed, hex colors → currentColor
 *   icons-custom/  → custom icons:  width/height removed, hex colors PRESERVED
 *
 * Both output to src/icons/*.tsx and are exported from the same index.ts.
 * Import path is identical: import { Gold, AddAlert } from '@openmetadata/ui-core-components/icons'
 *
 * Adding a regular icon:
 *   1. Drop SVG in icons/  →  yarn icons:generate
 *
 * Adding a custom/gradient icon (preserves brand colors):
 *   1. Drop SVG in icons-custom/  →  yarn icons:generate
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { transform } from '@svgr/core';
import { optimize } from 'svgo';
import prettierModule from 'prettier';
import { ESLint } from 'eslint';

const prettier = prettierModule.default ?? prettierModule;

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const prettierConfig = await prettier.resolveConfig(join(ROOT, '.prettierrc.yaml'));
const eslint = new ESLint({ cwd: ROOT, fix: true });

const ICONS_DIR = join(ROOT, 'icons');
const CUSTOM_DIR = join(ROOT, 'icons-custom');
const OUT_DIR = join(ROOT, 'src', 'icons');

const createComponentTemplate = require('../templates/component.cjs');

/** Convert any filename to a valid PascalCase component name. */
function toComponentName(filename) {
  return filename
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** Run this package's own eslint --fix (react/jsx-sort-props, padding-line-
 *  between-statements, etc. from eslint.config.mjs) against generated code,
 *  matching the same auto-fix pass CI's ui-checkstyle job applies. */
async function eslintFix(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.output ?? code;
}

/** SVGO plugins shared by both pipelines. */
const sharedPlugins = [
  {
    name: 'preset-default',
    params: { overrides: { removeViewBox: false } },
  },
  { name: 'cleanupIds', params: { minify: true, remove: true } },
  // Remove the root <svg>'s width/height — SVGR's svgProps re-injects them
  // dynamically as size props. Root-only by design, so inner shapes (e.g. a
  // <rect> that legitimately carries width/height as geometry) keep theirs.
  { name: 'removeDimensions' },
  // Remove other layout/meta attributes that SVGR re-injects dynamically.
  // 'id' excluded — cleanupIds already prunes unreferenced ids safely.
  // 'stroke-width' excluded — preserves each icon's designed stroke weight.
  {
    name: 'removeAttrs',
    params: {
      attrs: ['xmlns', 'data-name', 'style'],
    },
  },
];

/** Regular icons only: svgProps re-injects stroke-linecap/stroke-linejoin
 *  uniformly at the root for outline-style icons, so per-element values are
 *  redundant and safe to drop. Custom icons keep their authored
 *  linecap/linejoin values — svgProps never re-injects them. */
const removeLinecapLinejoin = {
  name: 'removeAttrs',
  params: { attrs: ['stroke-linecap', 'stroke-linejoin'] },
};

/** SVGO config for regular icons — also replaces hardcoded hex colors with currentColor. */
const svgoRegularConfig = {
  multipass: true,
  plugins: [
    ...sharedPlugins,
    removeLinecapLinejoin,
    // Replace hardcoded hex colors so icons are fully themeable via the color prop.
    // fill="none", fill="white", and fill="url(...)" are preserved as-is.
    {
      name: 'replaceHardcodedColors',
      fn: () => ({
        element: {
          enter: (node) => {
            const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
            for (const attr of ['fill', 'stroke']) {
              const val = node.attributes[attr];
              if (
                val &&
                val !== 'none' &&
                val !== 'white' &&
                val !== 'currentColor' &&
                !val.startsWith('url(') &&
                HEX.test(val)
              ) {
                node.attributes[attr] = 'currentColor';
              }
            }
          },
        },
      }),
    },
  ],
};

/** SVGO config for custom icons — same as regular but skips color replacement.
 *  IDs are also prefixed with the icon name to prevent gradient/mask conflicts
 *  when multiple custom icons render on the same page. */
const svgoCustomConfig = (iconBaseName) => ({
  multipass: true,
  plugins: [
    ...sharedPlugins,
    {
      name: 'prefixIds',
      params: { prefix: iconBaseName, delim: '_' },
    },
  ],
});

/** SVGR config, parameterized by pipeline.
 *  Regular icons: outline-style — forced to a single themeable stroke via the
 *  color prop, with fill/linecap/linejoin normalized.
 *  Custom icons: full-color/gradient/brand art — only size control is
 *  injected; stroke/fill/linecap/linejoin are left exactly as authored
 *  (post-SVGO) so hardcoded brand colors survive. */
function buildSvgrConfig(isCustom) {
  return {
    plugins: ['@svgr/plugin-jsx'],
    typescript: true,
    expandProps: 'end',
    svgo: false,
    prettier: false,
    template: createComponentTemplate(isCustom),
    svgProps: isCustom
      ? {
          width: '{size}',
          height: '{size}',
          'aria-hidden': 'true',
        }
      : {
          width: '{size}',
          height: '{size}',
          stroke: '{color}',
          fill: 'none',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
  };
}

async function processFolder(dir, isCustom, generatedNames) {
  if (!existsSync(dir)) return;

  const svgFiles = readdirSync(dir)
    .filter((f) => f.endsWith('.svg'))
    .sort((a, b) => a.localeCompare(b));
  if (svgFiles.length === 0) return;

  for (const svgFile of svgFiles) {
    const baseName = basename(svgFile, '.svg');
    const componentName = toComponentName(baseName);
    const inputPath = join(dir, svgFile);
    const outputPath = join(OUT_DIR, `${componentName}.tsx`);

    const rawSvg = readFileSync(inputPath, 'utf8');

    const { data: optimizedSvg } = optimize(rawSvg, {
      ...(isCustom ? svgoCustomConfig(baseName) : svgoRegularConfig),
      path: inputPath,
    });

    const svgrConfig = buildSvgrConfig(isCustom);
    const tsx = await transform(optimizedSvg, svgrConfig, { componentName });
    const fixedTsx = await eslintFix(tsx, outputPath);
    const formattedTsx = await prettier.format(fixedTsx, {
      ...prettierConfig,
      parser: 'typescript',
      filepath: outputPath,
    });

    writeFileSync(outputPath, formattedTsx, 'utf8');
    generatedNames.push(componentName);
    console.log(`  ✓ ${componentName}`);
  }
}

async function main() {
  if (!existsSync(ICONS_DIR) && !existsSync(CUSTOM_DIR)) {
    console.log('No icons/ or icons-custom/ directory found — nothing to generate.');
    return;
  }

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  const generatedNames = [];

  const regularCount = existsSync(ICONS_DIR)
    ? readdirSync(ICONS_DIR).filter((f) => f.endsWith('.svg')).length
    : 0;
  const customCount = existsSync(CUSTOM_DIR)
    ? readdirSync(CUSTOM_DIR).filter((f) => f.endsWith('.svg')).length
    : 0;

  console.log(`Processing ${regularCount} regular + ${customCount} custom icon(s)...`);

  await processFolder(ICONS_DIR, false, generatedNames);
  await processFolder(CUSTOM_DIR, true, generatedNames);

  // Remove stale .tsx output for SVGs deleted from icons/ or icons-custom/
  // since the last run — processFolder only ever adds/updates files, so
  // without this, a removed SVG's .tsx keeps existing (unused, unexported)
  // forever. Scoped to .tsx only: OUT_DIR also holds hand-authored files
  // (e.g. types.ts) that generate-icons.mjs must never touch.
  const expectedTsxFiles = new Set(generatedNames.map((name) => `${name}.tsx`));
  for (const existingFile of readdirSync(OUT_DIR)) {
    if (existingFile.endsWith('.tsx') && !expectedTsxFiles.has(existingFile)) {
      unlinkSync(join(OUT_DIR, existingFile));
      console.log(`  ✗ removed stale ${existingFile}`);
    }
  }

  // Generate index.ts
  const allExports = generatedNames
    .map((name) => `export { ${name} } from './${name}'`)
    .join('\n');

  const indexContent = `/*
 *  Copyright 2025 Collate.
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

// This file is auto-generated by scripts/generate-icons.mjs — do not edit manually.
// Run \`yarn icons:generate\` to regenerate after adding SVGs to icons/ or icons-custom/.

export type { IconProps } from '../icons-static/types';
${allExports}
`;

  const indexPath = join(OUT_DIR, 'index.ts');
  const fixedIndexContent = await eslintFix(indexContent, indexPath);
  const formattedIndexContent = await prettier.format(fixedIndexContent, {
    ...prettierConfig,
    parser: 'typescript',
    filepath: indexPath,
  });

  writeFileSync(indexPath, formattedIndexContent, 'utf8');

  console.log(`\nGenerated ${generatedNames.length} icons → src/icons/`);
  console.log('Updated src/icons/index.ts');
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
