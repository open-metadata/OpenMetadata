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
 * Converts SVG files from icons/ into TypeScript React components in src/icons/.
 *
 * Usage:
 *   yarn icons:generate
 *
 * Workflow:
 *   1. Read *.svg from icons/  (kebab-case source files, committed to repo)
 *   2. Optimize each SVG with SVGO (two paths: regular vs colored)
 *   3. Transform to TSX with SVGR
 *   4. Write {PascalCase}.tsx files to src/icons/
 *   5. Generate src/icons/index.ts barrel
 *
 * Adding a new colored/gradient icon:
 *   1. Drop the SVG in icons/
 *   2. Add the kebab-case filename (without .svg) to COLORED_ICONS below
 *   3. Run yarn icons:generate
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { transform } from '@svgr/core';
import { optimize } from 'svgo';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const RAW_DIR = join(ROOT, 'icons');
const OUT_DIR = join(ROOT, 'src', 'icons');
const STATIC_DIR = join(ROOT, 'src', 'icons-static');

const componentTemplate = require('../templates/component.cjs');
const coloredComponentTemplate = require('../templates/colored-component.cjs');

/**
 * Icons with gradients/fills that must preserve their original colors.
 * Add the kebab-case SVG filename (without .svg) here when adding a new
 * colored/gradient icon. The script will use a separate pipeline that
 * skips color normalization and preserves all fills and strokes.
 */
const COLORED_ICONS = new Set(['gold', 'silver', 'bronze', 'none']);

/** Convert any filename to a valid PascalCase component name. */
function toComponentName(filename) {
  return filename
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** SVGO config for regular stroke-only icons. */
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
    // fill="none", fill="white", and fill="url(...)" are preserved.
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

/** SVGO config for colored/gradient icons — preserves all colors, prefixes IDs. */
const svgoColoredConfig = (iconBaseName) => ({
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: { overrides: { removeViewBox: false } },
    },
    // Prefix all IDs with the icon name to prevent gradient/mask ID conflicts
    // when multiple colored icons render on the same page.
    {
      name: 'prefixIds',
      params: { prefix: iconBaseName, delim: '_' },
    },
    // Only remove non-color layout/meta attributes.
    {
      name: 'removeAttrs',
      params: {
        attrs: ['xmlns', 'width', 'height', 'data-name', 'style'],
      },
    },
  ],
});

/** SVGR config for regular icons — injects stroke/fill/size at SVG root. */
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

/** SVGR config for colored icons — no color/stroke injection, size prop only. */
const svgrColoredConfig = {
  plugins: ['@svgr/plugin-jsx'],
  typescript: true,
  expandProps: 'end',
  svgo: false,
  prettier: false,
  template: coloredComponentTemplate,
  svgProps: {
    width: '{size}',
    height: '{size}',
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
    console.log('No SVG files in icons/ — nothing to generate.');
    return;
  }

  console.log(`Processing ${svgFiles.length} SVG file(s)...`);

  const generatedNames = [];

  for (const svgFile of svgFiles) {
    const baseName = basename(svgFile, '.svg');
    const componentName = toComponentName(baseName);
    const inputPath = join(RAW_DIR, svgFile);
    const outputPath = join(OUT_DIR, `${componentName}.tsx`);
    const isColored = COLORED_ICONS.has(baseName);

    const rawSvg = readFileSync(inputPath, 'utf8');

    // Step 1: Optimize with SVGO (different config for colored icons)
    const { data: optimizedSvg } = optimize(rawSvg, {
      ...(isColored ? svgoColoredConfig(baseName) : svgoConfig),
      path: inputPath,
    });

    // Step 2: Transform to TSX with SVGR
    const tsx = await transform(
      optimizedSvg,
      isColored ? svgrColoredConfig : svgrConfig,
      { componentName }
    );

    writeFileSync(outputPath, tsx, 'utf8');
    generatedNames.push(componentName);
    console.log(`  ${isColored ? '🎨' : '✓'} ${componentName}`);
  }

  // Step 3: Generate index.ts
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
// Run \`yarn icons:generate\` to regenerate after adding SVGs to icons/.

export type { IconProps } from '../icons-static/types';
${allExports}
`;

  writeFileSync(join(OUT_DIR, 'index.ts'), indexContent, 'utf8');

  const coloredCount = generatedNames.filter((n) => COLORED_ICONS.has(n.toLowerCase())).length;
  console.log(`\nGenerated ${generatedNames.length - coloredCount} regular + ${coloredCount} colored icons → src/icons/`);
  console.log('Updated src/icons/index.ts');
  console.log('\nRemember to update src/icons-static/categories.ts with any new icon names.');
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
