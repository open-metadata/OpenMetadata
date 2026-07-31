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
 * Converts SVG files from icons/ into TypeScript React components in src/icons/,
 * mirroring the @untitledui/icons structure exactly.
 *
 * Usage:
 *   yarn icons:generate
 *
 * Workflow:
 *   1. Read *.svg from icons/  (kebab-case source files, committed to repo)
 *   2. Optimize each SVG with SVGO
 *   3. Transform to TSX with SVGR using templates/component.cjs
 *   4. Write {PascalCase}.tsx files to src/icons/
 *   5. Generate src/icons/index.ts barrel using templates/index.cjs
 *
 * NOTE: categories.ts is NOT touched by this script — update it manually.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { transform } from '@svgr/core';
import { optimize } from 'svgo';
import { createRequire as cjsRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const RAW_DIR = join(ROOT, 'icons');
const OUT_DIR = join(ROOT, 'src', 'icons');

const componentTemplate = require('../templates/component.cjs');
const indexTemplate = require('../templates/index.cjs');

/** Colored icons that use gradients/fills — hand-written, never overwritten by the script. */
const COLORED_ICONS = new Set(['gold', 'silver', 'bronze', 'none']);

/** Convert any filename to a valid PascalCase component name.
 * Splits on any non-alphanumeric sequence so "Create Folder", "ML models 2",
 * "Behavior & Personality" etc. all produce clean identifiers. */
function toComponentName(filename) {
  return filename
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** SVGO configuration — cleans SVGs for inline React use. */
const svgoConfig = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: { overrides: { removeViewBox: false } },
    },
    { name: 'cleanupIds', params: { minify: true, remove: true } },
    // Remove layout/meta attributes that SVGR injects at the SVG root level.
    {
      name: 'removeAttrs',
      params: {
        attrs: ['xmlns', 'width', 'height', 'stroke-width',
                'stroke-linecap', 'stroke-linejoin', 'data-name', 'id', 'style'],
      },
    },
    // Replace hardcoded hex colors with currentColor so icons are fully themeable.
    // fill="none" and fill="white" are left unchanged.
    // fill="url(...)" (gradient refs) are also left unchanged.
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

/** SVGR config — SVG attributes injected at the svg element level by the template.
 * SVGR v8 requires an explicit plugins array; omitting it skips all transforms. */
const svgrConfig = {
  plugins: ['@svgr/plugin-jsx'],
  typescript: true,
  expandProps: 'end',
  svgo: false,
  prettier: false,
  template: componentTemplate,
  svgProps: {
    width: '{size}',
    height: '{size}',
    stroke: '{color}',
    strokeWidth: '1.3',
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  },
};

async function main() {
  if (!existsSync(RAW_DIR)) {
    console.log(`icons/ directory not found — nothing to generate.`);
    console.log('Add kebab-case SVG files to icons/ and re-run yarn icons:generate.');
    return;
  }

  const svgFiles = readdirSync(RAW_DIR).filter((f) => f.endsWith('.svg'));

  if (svgFiles.length === 0) {
    console.log('No SVG files in src/icons/raw/ — nothing to generate.');
    return;
  }

  console.log(`Processing ${svgFiles.length} SVG file(s)...`);

  const generatedNames = [];

  for (const svgFile of svgFiles) {
    const baseName = basename(svgFile, '.svg');
    const componentName = toComponentName(baseName);
    const inputPath = join(RAW_DIR, svgFile);
    const outputPath = join(OUT_DIR, `${componentName}.tsx`);

    if (COLORED_ICONS.has(baseName)) {
      generatedNames.push(componentName);
      console.log(`  ⬜ ${componentName} (colored — hand-written, skipped)`);
      continue;
    }

    const rawSvg = readFileSync(inputPath, 'utf8');

    // Step 1: Optimize with SVGO
    const { data: optimizedSvg } = optimize(rawSvg, {
      ...svgoConfig,
      path: inputPath,
    });

    // Step 2: Transform to TSX with SVGR
    const tsx = await transform(optimizedSvg, svgrConfig, { componentName });

    writeFileSync(outputPath, tsx, 'utf8');
    generatedNames.push(componentName);
    console.log(`  ✓ ${componentName}`);
  }

  // Step 3: Generate index.ts
  const outputFiles = generatedNames.map((name) => join(OUT_DIR, `${name}.tsx`));
  const indexContent = indexTemplate(outputFiles);
  writeFileSync(join(OUT_DIR, 'index.ts'), indexContent, 'utf8');

  console.log(`\nGenerated ${generatedNames.length} icons → src/icons/`);
  console.log('Updated src/icons/index.ts');
  console.log('\nRemember to update src/icons/categories.ts with the new icon names.');
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
