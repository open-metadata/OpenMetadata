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
 * Color canonicalization shared by the extractor, audit, and migrate tools.
 * Opaque colors collapse to a 6-digit lowercase hex so `#FFF`, `#ffffff`,
 * and `rgb(255 255 255)` all match. Colors with alpha keep an `rgba:` form.
 */

function clamp255(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex2(n) {
  return clamp255(n).toString(16).padStart(2, '0');
}

function expandHex(hex) {
  let h = hex.replace('#', '').toLowerCase();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  } else if (h.length === 4) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return h;
}

/**
 * Returns a canonical key for a color literal, or null if it is not a
 * concrete color (e.g. `transparent`, `currentColor`, a var()).
 */
function canonicalizeColor(raw) {
  const value = raw.trim().toLowerCase();
  let result = null;

  const hexMatch = value.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    const h = expandHex(value);
    if (h.length === 6) {
      result = '#' + h;
    } else if (h.length === 8) {
      const a = parseInt(h.slice(6, 8), 16) / 255;
      result =
        a >= 0.999
          ? '#' + h.slice(0, 6)
          : `rgba:${parseInt(h.slice(0, 2), 16)},${parseInt(
              h.slice(2, 4),
              16
            )},${parseInt(h.slice(4, 6), 16)},${round3(a)}`;
    }
  } else {
    const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/);
    if (rgbMatch) {
      result = canonicalizeRgb(rgbMatch[1]);
    }
  }

  return result;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function canonicalizeRgb(inner) {
  const parts = inner
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean);
  let result = null;
  if (parts.length >= 3) {
    const r = parseChannel(parts[0]);
    const g = parseChannel(parts[1]);
    const b = parseChannel(parts[2]);
    let a = 1;
    if (parts.length >= 4) {
      a = parts[3].endsWith('%')
        ? parseFloat(parts[3]) / 100
        : parseFloat(parts[3]);
    }
    if (![r, g, b].some((c) => Number.isNaN(c)) && !Number.isNaN(a)) {
      result =
        a >= 0.999
          ? '#' + toHex2(r) + toHex2(g) + toHex2(b)
          : `rgba:${clamp255(r)},${clamp255(g)},${clamp255(b)},${round3(a)}`;
    }
  }
  return result;
}

function parseChannel(token) {
  return token.endsWith('%')
    ? (parseFloat(token) / 100) * 255
    : parseFloat(token);
}

/** Human-friendly slug used when minting a legacy token name from a color. */
function colorSlug(canon) {
  let slug;
  if (canon.startsWith('#')) {
    slug = canon.slice(1);
  } else {
    slug = canon.replace('rgba:', '').replace(/[.,]/g, '-');
  }
  return slug;
}

module.exports = { canonicalizeColor, canonicalizeRgb, colorSlug, expandHex };
