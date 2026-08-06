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
 * Maps arbitrary Tailwind values (`tw:<prop>-[<value>]`) to the design-system
 * utility that should replace them. Shared by the Tailwind audit and codemod so
 * the linter and the codemod agree.
 *
 * Colours resolve by EXACT match to the upstream palette (globals.css), so a
 * migration never shifts a colour in light mode. Palette utilities (e.g.
 * `bg-gray-900`) are the safe target; semantic utilities (`bg-primary`) are the
 * *recommended* target for new work but are not auto-assigned, because a raw hex
 * carries no semantic intent.
 */
const { canonicalizeColor } = require('./color-utils');

const UPSTREAM = require('./upstream-palette.json').palette;

// Tailwind color-bearing prefixes (v4, with the `tw:` prefix stripped upstream).
const COLOR_PREFIXES = [
  'bg',
  'text',
  'border',
  'border-t',
  'border-r',
  'border-b',
  'border-l',
  'border-x',
  'border-y',
  'fill',
  'stroke',
  'outline',
  'decoration',
  'divide',
  'accent',
  'caret',
  'placeholder',
  'from',
  'via',
  'to',
  'ring', // eslint-banned; surfaced as a warning (→ border/outline), never auto-fixed
  'shadow', // box-shadow colour; surfaced as a warning (→ shadow token), never auto-fixed
];

// Colour-bearing prefixes that must NOT be auto-fixed to `tw:<prefix>-<palette>`:
// `tw:ring-*` is eslint-banned (use border/outline) and an arbitrary `tw:shadow`
// colour should use an elevation token. The audit still surfaces them — as a
// warning with a manual hint — but never as an auto-applicable error.
const BANNED_COLOR_PREFIXES = new Set(['ring', 'shadow']);

const SPACING_PREFIXES = [
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me',
  'gap', 'gap-x', 'gap-y',
  'space-x', 'space-y',
];

const RADIUS_PREFIXES = [
  'rounded', 'rounded-t', 'rounded-r', 'rounded-b', 'rounded-l',
  'rounded-tl', 'rounded-tr', 'rounded-br', 'rounded-bl',
];

// Sizing prefixes are NOT spacing tokens — they are layout dimensions and must
// not be rewritten to a spacing step.
const SIZING_PREFIXES = new Set([
  'w', 'h', 'min-w', 'max-w', 'min-h', 'max-h', 'size', 'basis',
  'top', 'right', 'bottom', 'left', 'inset', 'translate-x', 'translate-y', 'z',
]);

// Tailwind's default spacing scale (× --spacing = 4px). px -> step.
const SPACING_STEPS = {
  0: '0', 2: '0.5', 4: '1', 6: '1.5', 8: '2', 10: '2.5', 12: '3',
  14: '3.5', 16: '4', 20: '5', 24: '6', 28: '7', 32: '8', 36: '9',
  40: '10', 44: '11', 48: '12', 56: '14', 64: '16', 80: '20', 96: '24',
};

// px / rem -> radius utility suffix.
const RADIUS_BY_PX = { 0: 'none', 2: 'xs', 4: 'sm', 6: 'md', 8: 'lg', 12: 'xl', 16: '2xl', 24: '3xl', 9999: 'full' };
const RADIUS_BY_REM = { 0.125: 'xs', 0.25: 'sm', 0.375: 'md', 0.5: 'lg', 0.75: 'xl', 1: '2xl', 1.5: '3xl' };

function classifyPrefix(prefix) {
  let kind = 'other';
  if (COLOR_PREFIXES.includes(prefix)) {
    kind = 'color';
  } else if (SPACING_PREFIXES.includes(prefix)) {
    kind = 'spacing';
  } else if (RADIUS_PREFIXES.includes(prefix)) {
    kind = 'radius';
  } else if (SIZING_PREFIXES.has(prefix)) {
    kind = 'sizing';
  }
  return kind;
}

// palette custom prop `--color-gray-900` -> utility suffix `gray-900`
function paletteSuffix(upstreamVar) {
  return upstreamVar.replace(/^--color-/, '');
}

/** Resolve an arbitrary color value to a utility, e.g. bg + #2e90fa -> bg-brand-500 */
function resolveColorUtility(prefix, rawValue) {
  const canon = canonicalizeColor(rawValue);
  let out = null;
  if (canon && UPSTREAM[canon]) {
    out = `tw:${prefix}-${paletteSuffix(UPSTREAM[canon])}`;
  }
  return out;
}

/**
 * For a raw hex/rgb that isn't in a Tailwind class (chart config, SVG prop,
 * style object), return the palette token it matches, or null. Not auto-fixable
 * — the value needs a human to pick `tw:*-<suffix>` or `var(--color-<suffix>)`.
 */
function paletteHint(rawValue) {
  const canon = canonicalizeColor(rawValue);
  return canon && UPSTREAM[canon] ? UPSTREAM[canon] : null;
}

function toPx(numStr, unit) {
  return unit === 'rem' ? parseFloat(numStr) * 16 : parseFloat(numStr);
}

/** Resolve an arbitrary spacing value, e.g. p + 8px -> p-2 */
function resolveSpacingUtility(prefix, numStr, unit) {
  const px = toPx(numStr, unit);
  const step = SPACING_STEPS[px];
  return step !== undefined ? `tw:${prefix}-${step}` : null;
}

/** Resolve an arbitrary radius value, e.g. rounded + 8px -> rounded-lg */
function resolveRadiusUtility(prefix, numStr, unit) {
  const suffix =
    unit === 'rem' ? RADIUS_BY_REM[parseFloat(numStr)] : RADIUS_BY_PX[parseFloat(numStr)];
  return suffix ? `tw:${prefix}-${suffix}` : null;
}

module.exports = {
  classifyPrefix,
  resolveColorUtility,
  paletteHint,
  resolveSpacingUtility,
  resolveRadiusUtility,
  COLOR_PREFIXES,
  BANNED_COLOR_PREFIXES,
  SPACING_PREFIXES,
  RADIUS_PREFIXES,
  SIZING_PREFIXES,
  UPSTREAM,
};
