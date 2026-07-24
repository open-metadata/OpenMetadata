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

/* Focused round-trip checks for the token scanner. Run: node scanner.test.js */
const assert = require('assert');
const { processText } = require('./scanner');

let pass = 0;
function check(name, input, expected) {
  const { newText } = processText(input, name);
  try {
    assert.strictEqual(newText, expected);
    pass++;
  } catch (e) {
    process.stderr.write(`\nFAIL: ${name}\n  in:  ${JSON.stringify(input)}\n  got: ${JSON.stringify(newText)}\n  exp: ${JSON.stringify(expected)}\n`);
    process.exitCode = 1;
  }
}

// color: exact palette match -> palette token
check(
  'palette color',
  '.a { color: #2e90fa; }',
  '.a { color: var(--om-color-brand-500); }'
);
// color: 3-digit expands and matches white
check('short hex white', '.a { color: #FFF; }', '.a { color: var(--om-color-white); }');
// color: no upstream home -> legacy token, exact value preserved
check(
  'legacy color',
  '.a { color: #2eaadc; }',
  '.a { color: var(--om-legacy-color-2eaadc); }'
);
// trailing whitespace before semicolon (regression for offset bug)
check(
  'trailing space value',
  '.a { padding: 8px ; }',
  '.a { padding: var(--om-space-8) ; }'
);
// spacing shorthand, multiple values, 0 stays 0
check(
  'spacing shorthand',
  '.a { margin: 0px 16px 8px 24px; }',
  '.a { margin: 0 var(--om-space-16) var(--om-space-8) var(--om-space-24); }'
);
// rem spacing converts to px token
check('rem spacing', '.a { gap: 0.5rem; }', '.a { gap: var(--om-space-8); }');
// negative margin -> calc wrapper
check(
  'negative margin',
  '.a { margin-top: -8px; }',
  '.a { margin-top: calc(-1 * var(--om-space-8)); }'
);
// border width 1px must NOT be touched; the color IS tokenized
check(
  'border width untouched, color tokenized',
  '.a { border: 1px solid #ccc; }',
  '.a { border: 1px solid var(--om-legacy-color-cccccc); }'
);
// hex inside url()/data-uri must be untouched
check(
  'url data-uri untouched',
  ".a { background: url('data:image/svg+xml,%23fff') no-repeat #fff; }",
  ".a { background: url('data:image/svg+xml,%23fff') no-repeat var(--om-color-white); }"
);
// value inside block comment untouched
check(
  'comment untouched',
  '.a { width: 100px; /* padding: 8px */ color: #fff; }',
  '.a { width: 100px; /* padding: 8px */ color: var(--om-color-white); }'
);
// width/top are out of scope -> untouched
check('width out of scope', '.a { width: 20px; top: 8px; }', '.a { width: 20px; top: 8px; }');
// border-radius -> radius token
check('radius', '.a { border-radius: 4px; }', '.a { border-radius: var(--om-radius-sm); }');
// font-size + font-weight
check(
  'font-size and weight',
  '.a { font-size: 14px; font-weight: 600; }',
  '.a { font-size: var(--om-font-size-sm); font-weight: var(--om-font-weight-semibold); }'
);
// z-index preserved exactly
check('z-index', '.a { z-index: 999; }', '.a { z-index: var(--om-z-999); }');
// transition duration
check(
  'transition duration',
  '.a { transition: all 0.2s ease; }',
  '.a { transition: all var(--om-duration-200) ease; }'
);
// box-shadow: offsets stay, color tokenized
check(
  'box-shadow color only',
  '.a { box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.12); }',
  '.a { box-shadow: 0px 2px 10px var(--om-legacy-color-0-0-0-0-12); }'
);
// LESS @variable usage untouched (not a literal)
check('less var untouched', '.a { color: @grey-15; }', '.a { color: @grey-15; }');
// LESS color function: hex inside darken() must stay raw (LESS needs a literal)
check(
  'less color fn untouched',
  '.a { color: darken(#ffffff, 5%); background: #fff; }',
  '.a { color: darken(#ffffff, 5%); background: var(--om-color-white); }'
);
// rgba with a LESS var must not be flagged/rewritten
check(
  'rgba less-var untouched',
  '.a { background: rgba(@grey, 0.1); }',
  '.a { background: rgba(@grey, 0.1); }'
);
// numeric rgba still tokenizes
check(
  'numeric rgba tokenized',
  '.a { color: rgba(10, 13, 18, 0.05); }',
  '.a { color: var(--om-legacy-color-10-13-18-0-05); }'
);
// masked token names: a digit inside var(--om-z-10) is NOT re-flagged
check(
  'no re-match inside var token name',
  '.a { z-index: var(--om-z-10); font-weight: var(--om-font-weight-bold); }',
  '.a { z-index: var(--om-z-10); font-weight: var(--om-font-weight-bold); }'
);
// raw fallback colour inside var() is still tokenized
check(
  'var fallback color tokenized',
  '.a { color: var(--x, #ffffff); }',
  '.a { color: var(--x, var(--om-color-white)); }'
);
// keyword inside a LESS @variable name must not be rewritten
check(
  'less @var font-weight untouched',
  '.a { font-weight: @font-bold; }',
  '.a { font-weight: @font-bold; }'
);
// number as operand of LESS math (outside calc) must stay raw
check(
  'less math operand untouched',
  '.a { padding: @size-sm - 2px @size-xl; }',
  '.a { padding: @size-sm - 2px @size-xl; }'
);
// but inside calc() the same shape IS tokenized (calc is runtime math)
check(
  'in-calc spacing tokenized',
  '.a { padding: calc(100% - 8px); }',
  '.a { padding: calc(100% - var(--om-space-8)); }'
);
check(
  'in-calc with less var tokenized',
  '.a { padding: calc(@x - 8px); }',
  '.a { padding: calc(@x - var(--om-space-8)); }'
);
// idempotency across every category (regression for z-index / font-weight)
const rich =
  '.a { color: #2e90fa; padding: 8px 13px; z-index: 999; font-weight: 600; ' +
  'border-radius: 4px; font-size: 14px; transition: all 0.2s ease; ' +
  'margin-top: -8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }';
const once = processText(rich, 't').newText;
const twice = processText(once, 't').newText;
check('idempotent (all categories)', twice, once);

process.stdout.write(`\n${pass} checks passed${process.exitCode ? ' (with failures above)' : ''}\n`);
