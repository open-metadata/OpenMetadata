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
 * Shared scanner for the Tailwind/TSX design-system audit and codemod.
 *
 * Errors (fail CI):
 *   - arbitrary Tailwind COLOR values:   tw:<colorprop>-[#hex | rgb(...)]
 *   - arbitrary Tailwind SPACING values: tw:<spacingprop>-[<Npx|Nrem>]
 *   - arbitrary Tailwind RADIUS values:  tw:rounded*-[<Npx|Nrem>]
 *   ...only when they resolve to an exact design-system utility.
 *
 * Warnings (do not fail CI):
 *   - arbitrary color/spacing/radius that does NOT resolve (calc/%/var/one-off)
 *   - raw #hex / rgb() outside a Tailwind class (chart configs, style objects…)
 *   - inline style={{ ... }} with a hardcoded colour or px
 *
 * Debt inventory (informational):
 *   - `import … from 'antd'`  (Antd is deprecated in favour of UntitledUI)
 *
 * Sizing utilities (w/h/min/max/size/inset/top/…) are layout dimensions, not
 * spacing tokens, and are never flagged.
 */
const map = require('./tailwind-map');

const SEVERITY = { ERROR: 'error', WARNING: 'warning', INFO: 'info' };

// tw:<variant:>*<prefix>-[<value>]
const ARBITRARY_RE = /tw:(?:[a-z][a-z0-9-]*:)*([a-z][a-z0-9-]*?)-\[([^\]]+)\]/g;
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_RE = /\brgba?\(\s*\d[\d.]*\s*[, ]\s*\d[\d.]*\s*[, ]\s*\d[\d.]*(?:\s*[,/]\s*\d[\d.]*%?)?\s*\)/g;
const NUM_UNIT_RE = /^(-?\d*\.?\d+)(px|rem)$/;
const ANTD_IMPORT_RE = /import\s+[^;]*?\bfrom\s+['"]antd(?:\/[^'"]*)?['"]/g;
const INLINE_STYLE_RE = /style=\{\{/g;

function lineColAt(text, index) {
  let line = 1;
  let last = -1;
  for (let i = 0; i < index; i++) {
    if (text[i] === '\n') {
      line++;
      last = i;
    }
  }
  return { line, col: index - last };
}

function classifyArbitrary(prefix, value) {
  const kind = map.classifyPrefix(prefix);
  let finding = null;

  if (kind === 'color' && map.BANNED_COLOR_PREFIXES.has(prefix)) {
    finding = {
      category: 'banned-arbitrary-color',
      severity: SEVERITY.WARNING,
      suggestion:
        prefix === 'ring'
          ? 'use tw:border-* / tw:outline-* (tw:ring-* is banned)'
          : 'use a tw:shadow-* elevation token',
    };
  } else if (kind === 'color') {
    const util = map.resolveColorUtility(prefix, value);
    finding = util
      ? { category: 'arbitrary-color', severity: SEVERITY.ERROR, suggestion: util }
      : { category: 'arbitrary-color', severity: SEVERITY.WARNING, suggestion: null };
  } else if (kind === 'spacing' || kind === 'radius') {
    const m = value.match(NUM_UNIT_RE);
    const util =
      m && kind === 'spacing'
        ? map.resolveSpacingUtility(prefix, m[1], m[2])
        : m
        ? map.resolveRadiusUtility(prefix, m[1], m[2])
        : null;
    finding = util
      ? { category: `arbitrary-${kind}`, severity: SEVERITY.ERROR, suggestion: util }
      : { category: `arbitrary-${kind}`, severity: SEVERITY.WARNING, suggestion: null };
  }
  // sizing / other arbitrary values are intentionally not flagged.
  return finding;
}

function scanText(text, relPath) {
  const findings = [];
  const push = (index, f) => {
    const pos = lineColAt(text, index);
    findings.push({ file: relPath, line: pos.line, col: pos.col, ...f });
  };

  let m;
  ARBITRARY_RE.lastIndex = 0;
  while ((m = ARBITRARY_RE.exec(text))) {
    const f = classifyArbitrary(m[1], m[2]);
    if (f) {
      push(m.index, { ...f, raw: m[0], property: m[1] });
    }
  }

  // raw colours that are NOT inside a tw arbitrary value (mask those first)
  const masked = text.replace(ARBITRARY_RE, (s) => ' '.repeat(s.length));
  for (const re of [HEX_RE, RGB_RE]) {
    re.lastIndex = 0;
    while ((m = re.exec(masked))) {
      const hint = map.paletteHint(m[0]);
      push(m.index, {
        category: 'raw-color',
        severity: SEVERITY.WARNING,
        raw: m[0],
        suggestion: hint ? `= ${hint} (use a token, not a raw hex)` : null,
      });
    }
  }

  INLINE_STYLE_RE.lastIndex = 0;
  while ((m = INLINE_STYLE_RE.exec(text))) {
    push(m.index, { category: 'inline-style', severity: SEVERITY.WARNING, raw: 'style={{', suggestion: null });
  }

  ANTD_IMPORT_RE.lastIndex = 0;
  while ((m = ANTD_IMPORT_RE.exec(text))) {
    push(m.index, { category: 'antd-import', severity: SEVERITY.INFO, raw: 'antd', suggestion: null });
  }

  return findings;
}

module.exports = { scanText, classifyArbitrary, SEVERITY, ARBITRARY_RE };
