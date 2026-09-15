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

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const GLOBALS_FILE = path.resolve(
  __dirname,
  '../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/styles/globals.css'
);
const TOKENS_FILE = path.resolve(__dirname, '../../src/styles/tokens.css');
const TAILWIND_REFERENCE_FILE = path.resolve(
  __dirname,
  '../../specs/tokens/tailwind-utility-reference.md'
);

function extractBlock(css, marker) {
  const markerIndex = css.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing ${marker} block`);

  const openBrace = css.indexOf('{', markerIndex);
  let depth = 0;

  for (let index = openBrace; index < css.length; index++) {
    if (css[index] === '{') {
      depth++;
    } else if (css[index] === '}') {
      depth--;
      if (depth === 0) {
        return css.slice(openBrace + 1, index);
      }
    }
  }

  assert.fail(`Unclosed ${marker} block`);
}

function declarations(block) {
  return new Map(
    [...block.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((match) => [
      match[1],
      match[2].trim(),
    ])
  );
}

test('keeps the light neutral scale stable and applies the approved dark scale', () => {
  const css = fs.readFileSync(GLOBALS_FILE, 'utf8');
  const light = declarations(extractBlock(css, '@theme static'));
  const dark = declarations(extractBlock(css, '.dark-mode'));
  const expectedLight = {
    25: 'var(--color-gray-25, #fdfdfd)',
    50: 'var(--color-gray-50, #fafafa)',
    100: 'var(--color-gray-100, #f5f5f5)',
    200: 'var(--color-gray-200, #e9eaeb)',
    300: 'var(--color-gray-300, #d5d7da)',
    400: 'var(--color-gray-400, #a4a7ae)',
    500: 'var(--color-gray-500, #717680)',
    600: 'var(--color-gray-600, #535862)',
    700: 'var(--color-gray-700, #414651)',
    800: 'var(--color-gray-800, #252b37)',
    900: 'var(--color-gray-900, #181d27)',
    950: 'var(--color-gray-950, #0a0d12)',
  };
  const expectedDark = {
    25: 'rgb(250 250 250)',
    50: 'rgb(247 247 247)',
    100: 'rgb(228 229 231)',
    200: 'rgb(217 218 221)',
    300: 'rgb(206 207 210)',
    400: 'rgb(148 151 156)',
    500: 'rgb(123 127 134)',
    600: 'rgb(97 101 108)',
    700: 'rgb(55 58 65)',
    800: 'rgb(34 38 47)',
    900: 'rgb(19 22 27)',
    950: 'rgb(12 14 18)',
  };

  for (const [step, value] of Object.entries(expectedLight)) {
    assert.equal(light.get(`--color-gray-${step}`), value);
  }
  for (const [step, value] of Object.entries(expectedDark)) {
    assert.equal(dark.get(`--color-gray-${step}`), value);
  }
});

test('keeps AI mode on the shared semantic token namespace', () => {
  const css = fs.readFileSync(GLOBALS_FILE, 'utf8');

  // A parallel AI palette would let domain code bypass the global light/dark contract.
  assert.doesNotMatch(css, /--ai-[\w-]+\s*:/);
});

test('exposes the approved surface roles to CSS and Tailwind in both themes', () => {
  const css = fs.readFileSync(GLOBALS_FILE, 'utf8');
  const light = declarations(extractBlock(css, '@theme static'));
  const dark = declarations(extractBlock(css, '.dark-mode'));
  const roles = {
    page: ['primary', 'gray-950'],
    canvas: ['secondary', 'gray-900'],
    surface: ['primary', 'gray-800'],
    raised: ['primary', 'gray-700'],
    'overlay-surface': ['primary', 'gray-800'],
  };

  for (const [role, [lightRole, darkRole]] of Object.entries(roles)) {
    assert.equal(
      light.get(`--color-bg-${role}`),
      `var(--color-bg-${role}, theme(--color-bg-${lightRole}))`
    );
    assert.equal(
      light.get(`--background-color-${role}`),
      `var(--background-color-${role}, theme(--color-bg-${role}))`
    );
    assert.equal(dark.get(`--color-bg-${role}`), `theme(--color-${darkRole})`);
    assert.equal(
      dark.get(`--tw-background-color-${role}`),
      `var(--color-bg-${role})`
    );
  }
});

test('separates subtle and interactive border roles in both themes', () => {
  const css = fs.readFileSync(GLOBALS_FILE, 'utf8');
  const light = declarations(extractBlock(css, '@theme static'));
  const dark = declarations(extractBlock(css, '.dark-mode'));

  assert.equal(
    light.get('--color-border-subtle'),
    'var(--color-border-subtle, theme(--color-border-secondary_alt))'
  );
  assert.equal(
    light.get('--color-border-hover'),
    'var(--color-border-hover, theme(--color-gray-400))'
  );
  assert.equal(
    dark.get('--color-border-subtle'),
    '--alpha(theme(--color-white) / 8%)'
  );
  assert.equal(
    dark.get('--color-border-secondary_alt'),
    '--alpha(theme(--color-white) / 8%)'
  );
  assert.equal(dark.get('--color-border-primary'), 'theme(--color-gray-700)');
  assert.equal(dark.get('--color-border-hover'), 'theme(--color-gray-600)');

  // Card/Table/Badge draw their subtle edge with `tw:outline-subtle`, so the
  // outline-color namespace must expose the subtle role in both themes —
  // without it Tailwind emits no color and the outline falls back to currentColor.
  assert.equal(
    light.get('--outline-color-subtle'),
    'var(--outline-color-subtle, theme(--color-border-subtle))'
  );
  assert.equal(
    dark.get('--outline-color-subtle'),
    'theme(--color-border-subtle)'
  );
  // `tw:outline-subtle` reads var(--tw-outline-color-subtle); without the dark
  // bridge entry the outline keeps its light initial value in dark mode.
  assert.equal(
    dark.get('--tw-outline-color-subtle'),
    'var(--color-border-subtle)'
  );

  for (const role of ['subtle', 'hover']) {
    assert.equal(
      light.get(`--border-color-${role}`),
      `var(--border-color-${role}, theme(--color-border-${role}))`
    );
    assert.equal(
      dark.get(`--tw-border-color-${role}`),
      `var(--color-border-${role})`
    );
  }
});

test('mirrors every dark utility-color remap into the --tw-color-* layer', () => {
  const css = fs.readFileSync(GLOBALS_FILE, 'utf8');
  const dark = declarations(extractBlock(css, '.dark-mode'));

  // tw:bg-/text-/outline-utility-* all read var(--tw-color-utility-*). A dark
  // --color-utility-* remap only reaches those utilities once mirrored into the
  // --tw-color-* layer; an unmirrored remap renders the light value in dark.
  const remapped = [...dark.keys()].filter((k) =>
    /^--color-utility-[a-z-]+-\d+$/.test(k)
  );

  assert.ok(remapped.length > 0, 'expected dark utility-color remaps');

  const missing = remapped.filter(
    (k) => !dark.has(k.replace('--color-', '--tw-color-'))
  );

  assert.deepEqual(missing, [], `unmirrored dark utility colors: ${missing}`);
});

test('keeps dark text readable and exposes dedicated link roles', () => {
  const css = fs.readFileSync(GLOBALS_FILE, 'utf8');
  const light = declarations(extractBlock(css, '@theme static'));
  const dark = declarations(extractBlock(css, '.dark-mode'));

  assert.equal(dark.get('--color-text-primary'), 'theme(--color-gray-50)');
  assert.equal(dark.get('--color-text-secondary'), 'theme(--color-gray-300)');
  assert.equal(dark.get('--color-text-tertiary'), 'theme(--color-gray-400)');
  assert.equal(dark.get('--color-text-placeholder'), 'theme(--color-gray-400)');
  assert.equal(dark.get('--color-text-disabled'), 'theme(--color-gray-500)');

  assert.equal(
    light.get('--color-text-link'),
    'var(--color-text-link, theme(--color-brand-600))'
  );
  assert.equal(
    light.get('--color-text-link-hover'),
    'var(--color-text-link-hover, theme(--color-brand-700))'
  );
  assert.equal(dark.get('--color-text-link'), 'theme(--color-brand-300)');
  assert.equal(dark.get('--color-text-link-hover'), 'theme(--color-brand-200)');
  assert.equal(dark.get('--tw-text-color-link'), 'var(--color-text-link)');
  assert.equal(
    dark.get('--tw-text-color-link-hover'),
    'var(--color-text-link-hover)'
  );
});

test('uses shared dark interaction and feedback recipes', () => {
  const css = fs.readFileSync(GLOBALS_FILE, 'utf8');
  const light = declarations(extractBlock(css, '@theme static'));
  const dark = declarations(extractBlock(css, '.dark-mode'));
  const backgrounds = {
    '--color-bg-primary_hover': '--alpha(theme(--color-white) / 6%)',
    '--color-bg-secondary_hover': '--alpha(theme(--color-white) / 6%)',
    '--color-bg-active': '--alpha(theme(--color-white) / 10%)',
    '--color-bg-brand-primary': '--alpha(theme(--color-brand-500) / 16%)',
    '--color-bg-error-primary': '--alpha(theme(--color-error-500) / 16%)',
    '--color-bg-warning-primary': '--alpha(theme(--color-warning-500) / 16%)',
    '--color-bg-success-primary': '--alpha(theme(--color-success-500) / 16%)',
  };
  const borders = {
    brand: ['brand-300', '--alpha(theme(--color-brand-400) / 35%)'],
    error: ['error-300', '--alpha(theme(--color-error-400) / 35%)'],
    warning: ['warning-300', '--alpha(theme(--color-warning-400) / 35%)'],
    success: ['success-300', '--alpha(theme(--color-success-400) / 35%)'],
  };

  for (const [token, value] of Object.entries(backgrounds)) {
    assert.equal(dark.get(token), value);
  }
  for (const [status, [lightRole, darkValue]] of Object.entries(borders)) {
    const token = `--color-border-${status}-subtle`;
    assert.equal(
      light.get(token),
      `var(${token}, theme(--color-${lightRole}))`
    );
    assert.equal(dark.get(token), darkValue);
    assert.equal(
      dark.get(`--tw-border-color-${status}-subtle`),
      `var(${token})`
    );
  }

  assert.equal(
    dark.get('--color-border-error_subtle'),
    'var(--color-border-error-subtle)'
  );
});

test('aliases semantic elevation roles to the existing shadow scale', () => {
  const css = fs.readFileSync(GLOBALS_FILE, 'utf8');
  const light = declarations(extractBlock(css, '@theme static'));

  assert.equal(light.get('--shadow-card'), 'theme(--shadow-xs)');
  assert.equal(light.get('--shadow-raised'), 'theme(--shadow-lg)');
  assert.equal(light.get('--shadow-overlay'), 'theme(--shadow-xl)');
});

test('exposes the approved roles through the legacy token bridge', () => {
  const tokens = declarations(
    extractBlock(fs.readFileSync(TOKENS_FILE, 'utf8'), ':root')
  );
  const aliases = {
    '--om-color-bg-page': 'var(--color-bg-page, #ffffff)',
    '--om-color-bg-canvas': 'var(--color-bg-canvas, #fafafa)',
    '--om-color-bg-surface': 'var(--color-bg-surface, #ffffff)',
    '--om-color-bg-raised': 'var(--color-bg-raised, #ffffff)',
    '--om-color-bg-overlay-surface': 'var(--color-bg-overlay-surface, #ffffff)',
    '--om-color-border-subtle': 'var(--color-border-subtle, rgb(0 0 0 / 0.08))',
    '--om-color-border-hover': 'var(--color-border-hover, #a4a7ae)',
    '--om-color-border-brand-subtle':
      'var(--color-border-brand-subtle, #84caff)',
    '--om-color-border-error-subtle':
      'var(--color-border-error-subtle, #fda29b)',
    '--om-color-border-warning-subtle':
      'var(--color-border-warning-subtle, #fec84b)',
    '--om-color-border-success-subtle':
      'var(--color-border-success-subtle, #75e0a7)',
    '--om-color-link': 'var(--color-text-link, #1570ef)',
    '--om-color-link-hover': 'var(--color-text-link-hover, #175cd3)',
    '--om-shadow-card': 'var(--shadow-card, var(--shadow-xs))',
    '--om-shadow-raised': 'var(--shadow-raised, var(--shadow-lg))',
    '--om-shadow-overlay': 'var(--shadow-overlay, var(--shadow-xl))',
  };

  for (const [token, value] of Object.entries(aliases)) {
    assert.equal(tokens.get(token), value);
  }
});

test('documents every approved go-forward utility', () => {
  const reference = fs.readFileSync(TAILWIND_REFERENCE_FILE, 'utf8');
  const utilities = [
    'tw:bg-page',
    'tw:bg-canvas',
    'tw:bg-surface',
    'tw:bg-raised',
    'tw:bg-overlay-surface',
    'tw:border-subtle',
    'tw:border-hover',
    'tw:border-brand-subtle',
    'tw:border-error-subtle',
    'tw:border-warning-subtle',
    'tw:border-success-subtle',
    'tw:text-link',
    'tw:text-link-hover',
    'tw:shadow-card',
    'tw:shadow-raised',
    'tw:shadow-overlay',
  ];

  for (const utility of utilities) {
    assert.match(reference, new RegExp(`\\b${utility}\\b`));
  }
});
