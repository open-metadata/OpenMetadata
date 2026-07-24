/*
 *  Copyright 2024 Collate.
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
 * Single source of truth for the OpenMetadata design-token layer.
 *
 * It maps raw CSS values (colors, spacing, radius, type, z-index, motion) to
 * the project token that should replace them, and records every token that is
 * actually referenced so `tokens.css` can be generated with exactly the tokens
 * the codebase uses. `token-audit.js` and `token-migrate.js` both consume it,
 * guaranteeing the linter and the codemod agree on the ruleset.
 *
 * Resolution is *exact-match*: a raw color only maps to an upstream palette
 * token when it is byte-for-byte the same color, so migration never shifts a
 * pixel. Colors with no upstream home become `--om-legacy-color-*` tokens that
 * hold the exact original value — centralizing the raw value in `tokens.css`
 * (the one place raw values may live) rather than eliminating it.
 */
const fs = require('fs');
const path = require('path');
const { canonicalizeColor, colorSlug } = require('./color-utils');

const UPSTREAM = require('./upstream-palette.json').palette;

// ---------------------------------------------------------------------------
// Scales (Layer 1 primitive values)
// ---------------------------------------------------------------------------

// px value -> whether it is part of the recommended "core" spacing scale.
const CORE_SPACING = new Set([
  0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96,
]);

// px -> radius token suffix.
const RADIUS_BY_PX = {
  0: 'none',
  2: 'xs',
  4: 'sm',
  6: 'md',
  8: 'lg',
  12: 'xl',
  16: '2xl',
  24: '3xl',
  9999: 'full',
};
const RADIUS_BY_REM = {
  0.125: 'xs',
  0.25: 'sm',
  0.375: 'md',
  0.5: 'lg',
  0.75: 'xl',
  1: '2xl',
  1.5: '3xl',
};
const RADIUS_VALUE = {
  none: '0px',
  xs: '2px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '24px',
  full: '9999px',
};

// px -> font-size token suffix (mirrors upstream --text-* scale).
const FONT_SIZE_BY_PX = {
  12: 'xs',
  14: 'sm',
  16: 'md',
  18: 'lg',
  20: 'xl',
  24: 'display-xs',
  30: 'display-sm',
  36: 'display-md',
  48: 'display-lg',
  60: 'display-xl',
  72: 'display-2xl',
};
const FONT_SIZE_VALUE = {
  xs: '12px',
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '20px',
  'display-xs': '24px',
  'display-sm': '30px',
  'display-md': '36px',
  'display-lg': '48px',
  'display-xl': '60px',
  'display-2xl': '72px',
};

const FONT_WEIGHT = {
  100: 'thin',
  300: 'light',
  normal: 'regular',
  400: 'regular',
  500: 'medium',
  600: 'semibold',
  bold: 'bold',
  700: 'bold',
  800: 'extrabold',
  900: 'black',
};
const FONT_WEIGHT_VALUE = {
  thin: '100',
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
};

// Recommended semantic z-index ladder (guidance; migration preserves exact
// values via --om-z-<n> so stacking order never changes).
const Z_LADDER = {
  base: 0,
  raised: 1,
  docked: 10,
  sticky: 100,
  dropdown: 1000,
  overlay: 1050,
  modal: 1500,
  popover: 2000,
  toast: 9000,
  max: 9999,
};

// ---------------------------------------------------------------------------
// Registry — records tokens actually referenced during a scan/migration.
// ---------------------------------------------------------------------------
const registry = {
  paletteColors: new Map(), // omName -> { dsName, upstreamVar, fallback }
  legacyColors: new Map(), // omName -> raw value
  spacing: new Map(), // px(number) -> true
  radius: new Map(), // suffix or px -> value
  fontSize: new Map(),
  fontWeight: new Map(), // suffix -> value
  zIndex: new Map(), // n -> true
  duration: new Map(), // ms(number) -> original unit value
  collisions: [], // { omName, existing, incoming, canon }
};

function resetRegistry() {
  Object.values(registry).forEach((m) => {
    if (m instanceof Map) {
      m.clear();
    } else if (Array.isArray(m)) {
      m.length = 0;
    }
  });
}

// ---------------------------------------------------------------------------
// Color resolution
// ---------------------------------------------------------------------------
function omPaletteName(upstreamVar) {
  // --color-gray-900 -> --om-color-gray-900
  return upstreamVar.replace(/^--color-/, '--om-color-');
}
function dsPaletteName(upstreamVar) {
  return upstreamVar.replace(/^--color-/, '--ds-color-');
}

/**
 * @param {string} raw a hex or rgb()/rgba() literal
 * @returns {{token:string, css:string}|null}
 */
function resolveColor(raw) {
  const canon = canonicalizeColor(raw);
  let out = null;
  if (canon) {
    if (UPSTREAM[canon]) {
      const upstreamVar = UPSTREAM[canon];
      const omName = omPaletteName(upstreamVar);
      registry.paletteColors.set(omName, {
        dsName: dsPaletteName(upstreamVar),
        upstreamVar,
        fallback: canon.startsWith('#') ? canon : rawFromCanon(canon),
      });
      out = { token: omName, css: `var(${omName})` };
    } else {
      const omName = `--om-legacy-color-${colorSlug(canon)}`;
      const value = normalizeRawColor(raw, canon);
      const existing = registry.legacyColors.get(omName);
      if (existing !== undefined && canonicalizeColor(existing) !== canon) {
        registry.collisions.push({ omName, existing, incoming: value, canon });
      }
      registry.legacyColors.set(omName, value);
      out = { token: omName, css: `var(${omName})` };
    }
  }
  return out;
}

function rawFromCanon(canon) {
  let value = canon;
  if (canon.startsWith('rgba:')) {
    const [r, g, b, a] = canon.slice(5).split(',');
    value = `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return value;
}

// Preserve the author's original hex/rgba spelling for the legacy token value
// where it is a clean literal; fall back to the canonical form otherwise.
function normalizeRawColor(raw, canon) {
  const trimmed = raw.trim().toLowerCase();
  return /^#[0-9a-f]{3,8}$/.test(trimmed) || /^rgba?\(/.test(trimmed)
    ? raw.trim()
    : rawFromCanon(canon);
}

// ---------------------------------------------------------------------------
// Spacing resolution
// ---------------------------------------------------------------------------
// CSS custom-property names cannot contain a dot, so a fractional px value uses
// `_` as the decimal separator: 3.5px -> --om-space-3_5.
function numSlug(n) {
  return String(n).replace('.', '_');
}

function resolveSpacing(pxNumber) {
  const abs = Math.abs(pxNumber);
  let out = null;
  if (abs === 0) {
    out = { css: '0', token: null };
  } else if (Number.isFinite(abs)) {
    registry.spacing.set(abs, true);
    const token = `--om-space-${numSlug(abs)}`;
    out =
      pxNumber < 0
        ? { css: `calc(-1 * var(${token}))`, token }
        : { css: `var(${token})`, token };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Radius resolution
// ---------------------------------------------------------------------------
function resolveRadius(numberValue, unit) {
  let suffix = null;
  if (unit === 'px') {
    suffix = RADIUS_BY_PX[numberValue];
  } else if (unit === 'rem') {
    suffix = RADIUS_BY_REM[numberValue];
  }
  let out = null;
  if (suffix) {
    registry.radius.set(suffix, RADIUS_VALUE[suffix]);
    out = { css: `var(--om-radius-${suffix})`, token: `--om-radius-${suffix}` };
  } else {
    const px = unit === 'rem' ? numberValue * 16 : numberValue;
    if (Number.isFinite(px)) {
      const slug = numSlug(px);
      registry.radius.set(slug, `${px}px`);
      out = { css: `var(--om-radius-${slug})`, token: `--om-radius-${slug}` };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Font-size resolution
// ---------------------------------------------------------------------------
function resolveFontSize(numberValue, unit) {
  let px = null;
  if (unit === 'px') {
    px = numberValue;
  } else if (unit === 'rem') {
    px = numberValue * 16;
  }
  let out = null;
  if (px !== null) {
    const suffix = FONT_SIZE_BY_PX[px];
    if (suffix) {
      registry.fontSize.set(suffix, FONT_SIZE_VALUE[suffix]);
      out = {
        css: `var(--om-font-size-${suffix})`,
        token: `--om-font-size-${suffix}`,
      };
    } else if (Number.isFinite(px)) {
      const slug = numSlug(px);
      registry.fontSize.set(slug, `${px}px`);
      out = {
        css: `var(--om-font-size-${slug})`,
        token: `--om-font-size-${slug}`,
      };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Font-weight resolution
// ---------------------------------------------------------------------------
function resolveFontWeight(raw) {
  const key = raw.trim().toLowerCase();
  const suffix = FONT_WEIGHT[key];
  let out = null;
  if (suffix) {
    registry.fontWeight.set(suffix, FONT_WEIGHT_VALUE[suffix]);
    out = {
      css: `var(--om-font-weight-${suffix})`,
      token: `--om-font-weight-${suffix}`,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// z-index resolution (exact value preserved)
// ---------------------------------------------------------------------------
function resolveZIndex(intValue) {
  registry.zIndex.set(intValue, true);
  const safe = String(intValue).replace('-', 'n');
  return { css: `var(--om-z-${safe})`, token: `--om-z-${safe}` };
}

// ---------------------------------------------------------------------------
// Duration resolution (normalized to ms; exact value preserved)
// ---------------------------------------------------------------------------
function resolveDuration(numberValue, unit) {
  const ms = unit === 's' ? Math.round(numberValue * 1000) : numberValue;
  let out = null;
  if (Number.isFinite(ms) && Number.isInteger(ms)) {
    registry.duration.set(ms, `${ms}ms`);
    out = { css: `var(--om-duration-${ms})`, token: `--om-duration-${ms}` };
  }
  return out;
}

// ---------------------------------------------------------------------------
// tokens.css generation for the "used" tokens
// ---------------------------------------------------------------------------
function emitGeneratedBlocks() {
  const blocks = [];
  blocks.push(emitPaletteBlock());
  blocks.push(emitLegacyColorBlock());
  blocks.push(emitSpacingExtBlock());
  blocks.push(emitRadiusExtBlock());
  blocks.push(emitFontSizeExtBlock());
  blocks.push(emitZIndexBlock());
  blocks.push(emitDurationBlock());
  return blocks.filter(Boolean).join('\n\n');
}

function sortByName(map) {
  return [...map.keys()].sort();
}
function sortByNum(map) {
  return [...map.keys()].sort((a, b) => Number(a) - Number(b));
}

function emitPaletteBlock() {
  // Full upstream palette (stable API) so any --om-color-<scale> resolves,
  // regardless of whether the codebase currently references it.
  const entries = Object.entries(UPSTREAM)
    .map(([canon, upstreamVar]) => ({
      canon,
      upstreamVar,
      dsName: dsPaletteName(upstreamVar),
      omName: omPaletteName(upstreamVar),
    }))
    .sort((a, b) => a.omName.localeCompare(b.omName));
  const l1 = entries
    .map((e) => `  ${e.dsName}: var(${e.upstreamVar}, ${e.canon});`)
    .join('\n');
  const l2 = entries
    .map((e) => `  ${e.omName}: var(${e.dsName});`)
    .join('\n');
  return (
    `  /* Palette passthrough — Layer 1 references upstream globals.css with a\n` +
    `     raw fallback; Layer 2 aliases are what components reference. */\n` +
    l1 +
    '\n\n' +
    l2
  );
}

function emitLegacyColorBlock() {
  const names = sortByName(registry.legacyColors);
  let block = null;
  if (names.length) {
    const lines = names
      .map((om) => `  ${om}: ${registry.legacyColors.get(om)};`)
      .join('\n');
    block =
      `  /* Legacy colors — exact values with no upstream palette home. These are\n` +
      `     the raw-value bucket (migration debt); consolidate into semantic\n` +
      `     tokens over time. Components reference these, not the raw hex. */\n` +
      lines;
  }
  return block;
}

function slugToNum(slug) {
  return Number(slug.replace('_', '.'));
}

function emitSpacingExtBlock() {
  const pxs = [...registry.spacing.keys()]
    .filter((px) => !CORE_SPACING.has(px))
    .sort((a, b) => a - b);
  let block = null;
  if (pxs.length) {
    const lines = pxs
      .map((px) => `  --om-space-${numSlug(px)}: ${px}px;`)
      .join('\n');
    block =
      `  /* Extended spacing — off-scale values in use. Prefer the core scale\n` +
      `     (--om-space-4/8/12/16/20/24/32/48/64) for new work. */\n` +
      lines;
  }
  return block;
}

function emitRadiusExtBlock() {
  const numeric = [...registry.radius.keys()].filter((k) => /^\d/.test(k));
  let block = null;
  if (numeric.length) {
    const lines = numeric
      .sort((a, b) => slugToNum(a) - slugToNum(b))
      .map((slug) => `  --om-radius-${slug}: ${registry.radius.get(slug)};`)
      .join('\n');
    block = `  /* Extended radius — off-scale values in use. */\n` + lines;
  }
  return block;
}

function emitFontSizeExtBlock() {
  const numeric = [...registry.fontSize.keys()].filter((k) => /^\d/.test(k));
  let block = null;
  if (numeric.length) {
    const lines = numeric
      .sort((a, b) => slugToNum(a) - slugToNum(b))
      .map((slug) => `  --om-font-size-${slug}: ${registry.fontSize.get(slug)};`)
      .join('\n');
    block = `  /* Extended font sizes — off-scale values in use. */\n` + lines;
  }
  return block;
}

function emitZIndexBlock() {
  const ns = sortByNum(registry.zIndex);
  let block = null;
  if (ns.length) {
    const lines = ns
      .map((n) => {
        const safe = String(n).replace('-', 'n');
        return `  --om-z-${safe}: ${n};`;
      })
      .join('\n');
    block =
      `  /* z-index — exact values preserved to keep stacking order identical.\n` +
      `     For new work prefer the semantic ladder documented in specs. */\n` +
      lines;
  }
  return block;
}

function emitDurationBlock() {
  const ms = sortByNum(registry.duration);
  let block = null;
  if (ms.length) {
    const lines = ms
      .map((n) => `  --om-duration-${n}: ${n}ms;`)
      .join('\n');
    block = `  /* Motion durations in use. */\n` + lines;
  }
  return block;
}

/**
 * Registers a token purely from a `var(--om-*)` usage found in a (possibly
 * already-migrated) file, so tokens.css generation is idempotent. Scale, radius,
 * font-size, z-index and duration values are recoverable from the token name;
 * legacy-color values come from the persisted sidecar passed in.
 */
function registerUsage(name, legacyColorValues) {
  let m;
  if ((m = name.match(/^--om-legacy-color-(.+)$/))) {
    const value = legacyColorValues && legacyColorValues.get(name);
    if (value !== undefined) {
      registry.legacyColors.set(name, value);
    }
  } else if ((m = name.match(/^--om-space-(\d+(?:_\d+)?)$/))) {
    registry.spacing.set(Number(m[1].replace('_', '.')), true);
  } else if ((m = name.match(/^--om-radius-(\d+(?:_\d+)?)$/))) {
    registry.radius.set(m[1], `${m[1].replace('_', '.')}px`);
  } else if ((m = name.match(/^--om-font-size-(\d+(?:_\d+)?)$/))) {
    registry.fontSize.set(m[1], `${m[1].replace('_', '.')}px`);
  } else if ((m = name.match(/^--om-z-(n?\d+)$/))) {
    registry.zIndex.set(Number(m[1].replace('n', '-')), true);
  } else if ((m = name.match(/^--om-duration-(\d+)$/))) {
    registry.duration.set(Number(m[1]), `${m[1]}ms`);
  }
}

module.exports = {
  resolveColor,
  registerUsage,
  resolveSpacing,
  resolveRadius,
  resolveFontSize,
  resolveFontWeight,
  resolveZIndex,
  resolveDuration,
  registry,
  resetRegistry,
  emitGeneratedBlocks,
  constants: {
    CORE_SPACING,
    RADIUS_VALUE,
    FONT_SIZE_VALUE,
    FONT_WEIGHT_VALUE,
    Z_LADDER,
    UPSTREAM,
  },
};
