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
 * Shared CSS/LESS scanner used by both the token audit and the token codemod.
 * A single pass over each declaration yields, per raw visual value, a "finding"
 * that carries a severity, the suggested token, and (for the codemod) the exact
 * text span to rewrite. Because the audit and the migrator run the same engine,
 * the linter can never disagree with the codemod about what is a violation.
 *
 * Safety guarantees:
 *   - comments, strings, and url()/data-URIs are masked first, so nothing
 *     inside them is ever matched or rewritten (offset-preserving mask);
 *   - px is only treated as spacing/radius/type inside the property that owns
 *     that meaning — a `1px` border width or a sprite `background-position`
 *     offset is never touched;
 *   - colors are matched value-level (a hex is always a color) but only outside
 *     protected spans.
 */
const path = require('path');
const map = require('./token-map');

const SEVERITY = { ERROR: 'error', WARNING: 'warning' };

const SPACING_PROPS = new Set([
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'padding-inline',
  'padding-block',
  'padding-inline-start',
  'padding-inline-end',
  'padding-block-start',
  'padding-block-end',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'margin-inline',
  'margin-block',
  'margin-inline-start',
  'margin-inline-end',
  'margin-block-start',
  'margin-block-end',
  'gap',
  'row-gap',
  'column-gap',
  'grid-gap',
  'grid-row-gap',
  'grid-column-gap',
]);

const RADIUS_PROPS = new Set([
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-start-start-radius',
  'border-start-end-radius',
  'border-end-start-radius',
  'border-end-end-radius',
  '-webkit-border-radius',
]);

const DURATION_PROPS = new Set([
  'transition',
  'transition-duration',
  'transition-delay',
  'animation',
  'animation-duration',
  'animation-delay',
  '-webkit-transition',
  '-webkit-animation',
]);

// Files that legitimately hold raw values (token definitions) or are vendored.
const EXEMPT_BASENAMES = new Set(['tokens.css', 'variables.less', 'quill-emoji.css']);

function isExempt(relOrAbsPath) {
  return EXEMPT_BASENAMES.has(path.basename(relOrAbsPath));
}

// ---------------------------------------------------------------------------
// Offset-preserving mask of comments / strings / url()
// ---------------------------------------------------------------------------
function maskProtected(text) {
  const chars = text.split('');
  const blank = (start, end) => {
    for (let i = start; i < end && i < chars.length; i++) {
      if (chars[i] !== '\n') {
        chars[i] = ' ';
      }
    }
  };
  maskBlockComments(text, blank);
  maskQuoted(text, blank, '"');
  maskQuoted(text, blank, "'");
  const masked1 = chars.join('');
  maskUrl(masked1, blank);
  const masked2 = chars.join('');
  maskLineComments(masked2, blank);
  return chars.join('');
}

function maskBlockComments(text, blank) {
  const re = /\/\*[\s\S]*?\*\//g;
  let m;
  while ((m = re.exec(text))) {
    blank(m.index, m.index + m[0].length);
  }
}

function maskQuoted(text, blank, quote) {
  const re = new RegExp(`${quote}(?:\\\\.|[^${quote}\\\\])*${quote}`, 'g');
  let m;
  while ((m = re.exec(text))) {
    blank(m.index, m.index + m[0].length);
  }
}

function maskUrl(text, blank) {
  const re = /url\((?:[^()]|\([^()]*\))*\)/gi;
  let m;
  while ((m = re.exec(text))) {
    // keep the `url(` and `)` so declarations still parse; blank the inside
    blank(m.index + 4, m.index + m[0].length - 1);
  }
}

function maskLineComments(text, blank) {
  const re = /\/\/[^\n]*/g;
  let m;
  while ((m = re.exec(text))) {
    blank(m.index, m.index + m[0].length);
  }
}

// ---------------------------------------------------------------------------
// Value transforms — each returns { edits:[{start,end,text}], findings:[...] }
// operating on the masked value; offsets are relative to the value start.
// ---------------------------------------------------------------------------
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
// Numeric rgb()/rgba() only — never matches LESS forms such as rgba(@c, .5)
// or rgb(from ...), which are not raw colors and must not be rewritten.
const RGB_RE =
  /\brgba?\(\s*\d[\d.]*\s*[, ]\s*\d[\d.]*\s*[, ]\s*\d[\d.]*(?:\s*[,/]\s*\d[\d.]*%?)?\s*\)/gi;
const NUM_UNIT_RE = /(-?\d*\.?\d+)(px|rem)\b/gi;
const DUR_RE = /(-?\d*\.?\d+)(ms|s)\b/gi;

// LESS colour functions require a real colour literal as input; a hex inside
// one must never become a var(). These spans are blanked before matching.
const LESS_COLOR_FN =
  /\b(?:darken|lighten|saturate|desaturate|fadein|fadeout|fade|mix|tint|shade|spin|multiply|screen|overlay|softlight|hardlight|difference|exclusion|average|negation)\(/gi;

function protectLessColorFns(maskedValue) {
  const chars = maskedValue.split('');
  let m;
  LESS_COLOR_FN.lastIndex = 0;
  while ((m = LESS_COLOR_FN.exec(maskedValue))) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = open; i < chars.length; i++) {
      if (maskedValue[i] === '(') {
        depth++;
      } else if (maskedValue[i] === ')') {
        depth--;
        if (depth === 0) {
          for (let j = open + 1; j < i; j++) {
            chars[j] = ' ';
          }
          break;
        }
      }
    }
  }
  return chars.join('');
}

function collectColors(maskedValue) {
  const hits = [];
  let m;
  HEX_RE.lastIndex = 0;
  while ((m = HEX_RE.exec(maskedValue))) {
    hits.push({ start: m.index, end: m.index + m[0].length, raw: m[0] });
  }
  RGB_RE.lastIndex = 0;
  while ((m = RGB_RE.exec(maskedValue))) {
    hits.push({ start: m.index, end: m.index + m[0].length, raw: m[0] });
  }
  return hits.sort((a, b) => a.start - b.start);
}

function makeFinding(prop, category, severity, hit, resolved) {
  return {
    property: prop,
    category,
    severity,
    raw: hit.raw,
    start: hit.start,
    end: hit.end,
    suggestion: resolved ? resolved.token : null,
    replacement: resolved ? resolved.css : null,
  };
}

// Blank custom-property identifiers (`--foo-bar`) so nothing inside an existing
// var(--om-*) token reference is re-matched. This keeps the codemod idempotent
// (a `10` inside `var(--om-z-10)` is not treated as a fresh z-index) while a raw
// fallback colour after the identifier (`var(--x, #fff)`) stays visible.
function maskCustomProps(maskedValue) {
  return maskedValue.replace(/--[A-Za-z0-9_-]+/g, (s) => ' '.repeat(s.length));
}

// Blank LESS @variable references so a keyword/number inside a variable name
// (e.g. `bold` in `@font-bold`) is never matched or rewritten.
function maskLessVars(maskedValue) {
  return maskedValue.replace(/@[A-Za-z0-9_-]+/g, (s) => ' '.repeat(s.length));
}

// Blank the interior of calc(...) so LESS-math detection ignores arithmetic that
// is inside calc() (which is evaluated at CSS runtime and is safe to tokenize).
function blankCalc(maskedValue) {
  const chars = maskedValue.split('');
  const re = /calc\(/gi;
  let m;
  while ((m = re.exec(maskedValue))) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = open; i < chars.length; i++) {
      if (maskedValue[i] === '(') {
        depth++;
      } else if (maskedValue[i] === ')') {
        depth--;
        if (depth === 0) {
          for (let j = open + 1; j < i; j++) {
            chars[j] = ' ';
          }
          break;
        }
      }
    }
  }
  return chars.join('');
}

// A LESS @variable used as an operand of +, -, *, / (outside calc) triggers
// compile-time math under `math: always`; tokenizing the numeric operand would
// break it. Detect that shape so such values are left untouched (and, via the
// shared scanner, are not flagged by the audit either).
const LESS_MATH =
  /@[\w-]+\s*[-+*/]\s*[.\d]|[.\d]\s*[*/]\s*@[\w-]+|[.\d](?:px|rem|em|%)?\s*[-+*/]\s*@[\w-]+/;

function transformValue(prop, value) {
  const base = maskCustomProps(protectLessColorFns(maskProtected(value)));
  const isLessExpr = LESS_MATH.test(blankCalc(base));
  const masked = maskLessVars(base);
  const findings = [];

  for (const hit of collectColors(masked)) {
    const resolved = map.resolveColor(hit.raw);
    findings.push(
      makeFinding(prop, 'color', SEVERITY.ERROR, hit, resolved)
    );
  }

  // Numeric values that are operands of LESS arithmetic must stay raw.
  if (isLessExpr) {
    return dedupeFindings(findings);
  }

  if (SPACING_PROPS.has(prop)) {
    collectUnit(masked).forEach((hit) => {
      const resolved = resolveSpacingHit(hit);
      // Resolvable spacing must be tokenized (error); a fractional/off-grid
      // value we cannot map cleanly is an uncommon value (warning).
      const severity = resolved ? SEVERITY.ERROR : SEVERITY.WARNING;
      findings.push(makeFinding(prop, 'spacing', severity, hit, resolved));
    });
  } else if (RADIUS_PROPS.has(prop)) {
    collectUnit(masked).forEach((hit) => {
      const resolved = map.resolveRadius(parseFloat(hit.num), hit.unit);
      findings.push(makeFinding(prop, 'radius', SEVERITY.WARNING, hit, resolved));
    });
  } else if (prop === 'font-size') {
    collectUnit(masked).forEach((hit) => {
      const resolved = map.resolveFontSize(parseFloat(hit.num), hit.unit);
      findings.push(
        makeFinding(prop, 'font-size', SEVERITY.WARNING, hit, resolved)
      );
    });
  } else if (prop === 'font-weight') {
    collectWeight(masked).forEach((hit) => {
      const resolved = map.resolveFontWeight(hit.raw);
      findings.push(
        makeFinding(prop, 'font-weight', SEVERITY.WARNING, hit, resolved)
      );
    });
  } else if (prop === 'z-index') {
    collectInt(masked).forEach((hit) => {
      const resolved = map.resolveZIndex(parseInt(hit.raw, 10));
      findings.push(
        makeFinding(prop, 'z-index', SEVERITY.WARNING, hit, resolved)
      );
    });
  } else if (DURATION_PROPS.has(prop)) {
    collectDuration(masked).forEach((hit) => {
      const resolved = map.resolveDuration(parseFloat(hit.num), hit.unit);
      findings.push(
        makeFinding(prop, 'duration', SEVERITY.WARNING, hit, resolved)
      );
    });
  }

  return dedupeFindings(findings);
}

function resolveSpacingHit(hit) {
  const px = hit.unit === 'rem' ? parseFloat(hit.num) * 16 : parseFloat(hit.num);
  return map.resolveSpacing(px);
}

function collectUnit(maskedValue) {
  const hits = [];
  let m;
  NUM_UNIT_RE.lastIndex = 0;
  while ((m = NUM_UNIT_RE.exec(maskedValue))) {
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
      num: m[1],
      unit: m[2].toLowerCase(),
    });
  }
  return hits;
}

function collectInt(maskedValue) {
  const hits = [];
  const re = /-?\d+/g;
  let m;
  while ((m = re.exec(maskedValue))) {
    hits.push({ start: m.index, end: m.index + m[0].length, raw: m[0] });
  }
  return hits;
}

function collectWeight(maskedValue) {
  const hits = [];
  const re = /\b(100|200|300|400|500|600|700|800|900|normal|bold|bolder|lighter)\b/gi;
  let m;
  while ((m = re.exec(maskedValue))) {
    hits.push({ start: m.index, end: m.index + m[0].length, raw: m[0] });
  }
  return hits;
}

function collectDuration(maskedValue) {
  const hits = [];
  let m;
  DUR_RE.lastIndex = 0;
  while ((m = DUR_RE.exec(maskedValue))) {
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
      num: m[1],
      unit: m[2].toLowerCase(),
    });
  }
  return hits;
}

// A value may match more than one collector at the same span (a color inside a
// box-shadow also being scanned by nothing else). Keep the first per span.
function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.start}:${f.end}:${f.category}`;
    const dup = seen.has(key);
    seen.add(key);
    return !dup;
  });
}

// ---------------------------------------------------------------------------
// Declaration walk
// ---------------------------------------------------------------------------
// m[1] property, m[2] the `:` separator (incl. surrounding space), m[3] value.
// Capturing the separator lets us compute the value's start offset exactly,
// independent of any trailing whitespace before the terminator.
const DECL_RE = /([a-zA-Z][a-zA-Z-]*)(\s*:\s*)([^;{}]+?)\s*(?=[;}])/g;

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

/**
 * @returns {{ newText:string, findings:Array }}
 */
function processText(text, relPath) {
  const masked = maskProtected(text);
  const edits = [];
  const findings = [];
  let m;
  DECL_RE.lastIndex = 0;
  while ((m = DECL_RE.exec(masked))) {
    const prop = m[1].toLowerCase();
    const valueStart = m.index + m[1].length + m[2].length;
    const rawValue = text.slice(valueStart, valueStart + m[3].length);
    const valueFindings = transformValue(prop, rawValue);
    for (const f of valueFindings) {
      const absStart = valueStart + f.start;
      const absEnd = valueStart + f.end;
      const pos = lineColAt(text, absStart);
      findings.push({
        file: relPath,
        line: pos.line,
        col: pos.col,
        property: prop,
        category: f.category,
        severity: f.severity,
        raw: f.raw,
        suggestion: f.suggestion,
      });
      if (f.replacement) {
        edits.push({ start: absStart, end: absEnd, text: f.replacement });
      }
    }
  }
  return { newText: applyEdits(text, edits), findings };
}

function applyEdits(text, edits) {
  const sorted = edits
    .slice()
    .sort((a, b) => a.start - b.start)
    .filter((e, i, arr) => i === 0 || e.start >= arr[i - 1].end);
  let out = '';
  let cursor = 0;
  for (const e of sorted) {
    out += text.slice(cursor, e.start) + e.text;
    cursor = e.end;
  }
  out += text.slice(cursor);
  return out;
}

module.exports = { processText, isExempt, SEVERITY, EXEMPT_BASENAMES };
