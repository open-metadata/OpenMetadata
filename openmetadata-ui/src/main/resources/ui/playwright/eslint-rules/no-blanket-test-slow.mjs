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

// Hooks/modifiers Playwright recognizes as a single member-expression suffix
// on a test object, e.g. `test.beforeEach`, `test.only`, `test.step`.
const BLANKET_HOOK_NAMES = new Set(['beforeEach']);
const OWN_SLOT_HOOK_NAMES = new Set(['beforeAll', 'afterAll', 'afterEach']);
const PER_TEST_MODIFIER_NAMES = new Set([
  'only',
  'fixme',
  'fail',
  'skip',
  'step',
]);

/**
 * Unwinds a (possibly chained) member expression callee — e.g.
 * `test.describe.serial` — into its root identifier and property path.
 * Returns null for callees that aren't a plain identifier or a chain of
 * plain-identifier member accesses (computed access, etc.), since those
 * can't be classified.
 */
const getCalleeInfo = (callee) => {
  const path = [];
  let node = callee;

  while (node?.type === 'MemberExpression') {
    if (node.property?.type !== 'Identifier' || node.computed) {
      return null;
    }

    path.unshift(node.property.name);
    node = node.object;
  }

  if (node?.type !== 'Identifier') {
    return null;
  }

  return { root: node.name, path };
};

const isSlowMethodCall = (node) => {
  if (node.callee?.type !== 'MemberExpression') {
    return false;
  }

  const info = getCalleeInfo(node.callee);

  return info?.path.length === 1 && info.path[0] === 'slow';
};

// A variable bound directly to the `describe` function itself — e.g.
// `const describeInParallel = test.describe;` (seen in TagsSuggestion.spec.ts)
// — is not a test *object*; calling it (`describeInParallel('suite', fn)`)
// is calling `describe`, structurally indistinguishable from a direct test
// invocation (`X('name', fn)`). Tracked separately so the direct-call signal
// below never mistakes such an alias for a per-test callback.
const collectDescribeAlias = (node, describeAliasNames) => {
  if (node.id.type !== 'Identifier' || !node.init) {
    return;
  }

  const info = getCalleeInfo(node.init);

  if (info?.path[0] === 'describe') {
    describeAliasNames.add(node.id.name);
  }
};

// A test object is whatever identifier is actually used as one in this file
// — normally `test`, but suites alias it (`const base = test.extend(...)`
// as `base`, `testPersona`, etc). The cheapest reliable signal that an
// identifier is a test object: it's used as `X.describe(...)`, or called
// directly as `X('name', fn)`. `test` is seeded unconditionally so a file
// that only ever calls `test.slow()` (no `test(...)`/`test.describe(...)`
// call in scope, e.g. an isolated snippet) still resolves. Signals are
// collected here and resolved into `testObjectIdentifiers` in `Program:exit`
// (see below), once `describeAliasNames` has been fully populated too.
const collectTestObjectSignal = (node, signals) => {
  const info = getCalleeInfo(node.callee);

  if (info?.path[0] === 'describe') {
    signals.push({ type: 'describeUsage', name: info.root });
    return;
  }

  if (node.callee.type !== 'Identifier' || node.arguments.length < 2) {
    return;
  }

  const [firstArg] = node.arguments;
  const lastArg = node.arguments[node.arguments.length - 1];
  const firstArgIsName =
    (firstArg.type === 'Literal' && typeof firstArg.value === 'string') ||
    firstArg.type === 'TemplateLiteral';
  const lastArgIsCallback =
    lastArg.type === 'ArrowFunctionExpression' ||
    lastArg.type === 'FunctionExpression';

  if (firstArgIsName && lastArgIsCallback) {
    signals.push({ type: 'directCall', name: node.callee.name });
  }
};

/**
 * Classifies the call that owns the function immediately enclosing `node`.
 *
 * Legal (per-test scope): a direct `test(name, fn)` invocation, or a
 * `test.only/fixme/fail/skip/step(...)` variant — the callback runs once
 * per test, so `slow()` inside it affects only that test.
 *
 * Also legal, but for a different reason — `beforeAll`, `afterAll`, and
 * `afterEach` each run on their own timeout slot (verified against
 * playwright@1.57.0's worker/workerMain.js: `_runEachHooksForSuites` for
 * these passes its own slot), so `slow()` there extends only the hook's own
 * budget, never a test's.
 *
 * Blanket: file scope (no enclosing function at all), any `describe*`
 * callback, `beforeEach` — which, unlike the other hooks, runs on the
 * *test's own* default timeout slot (workerMain.js calls
 * `_runEachHooksForSuites(suites, 'beforeEach', testInfo)` with no slot
 * argument) before every test in scope, so `slow()` there has the same
 * blast radius as a describe-scope call — and any unknown wrapper, which we
 * can't prove is per-test scoped.
 */
const classifyEnclosingCall = (node, testObjectIdentifiers) => {
  for (let current = node.parent; current; current = current.parent) {
    const isFunction =
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'FunctionExpression';

    if (!isFunction) {
      continue;
    }

    const call = current.parent;

    if (call?.type !== 'CallExpression') {
      return 'blanket';
    }

    const info = getCalleeInfo(call.callee);

    if (!info || !testObjectIdentifiers.has(info.root)) {
      return 'blanket';
    }

    if (info.path.length === 0) {
      return 'legal';
    }

    const [method] = info.path;

    if (method === 'describe') {
      return 'blanket';
    }

    if (info.path.length === 1 && BLANKET_HOOK_NAMES.has(method)) {
      return 'blanket';
    }

    if (info.path.length === 1 && OWN_SLOT_HOOK_NAMES.has(method)) {
      return 'legal';
    }

    if (info.path.length === 1 && PER_TEST_MODIFIER_NAMES.has(method)) {
      return 'legal';
    }

    return 'blanket';
  }

  return 'blanket';
};

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow test.slow() at file or describe scope',
    },
    schema: [],
    messages: {
      blanketSlow:
        'test.slow() at file or describe scope triples the timeout for every test in scope and hides real performance regressions. Move it inside the single test that genuinely needs it.',
    },
  },

  create(context) {
    // Identifier resolution needs the whole file, so candidate `.slow()`
    // calls and test-object signals are collected during the single
    // traversal and resolved/classified in `Program:exit`, once every
    // `describe`/test-invocation alias and describe-function alias in the
    // file has been seen (declaration order shouldn't matter).
    const testObjectIdentifiers = new Set(['test']);
    const describeAliasNames = new Set();
    const testObjectSignals = [];
    const slowCallCandidates = [];

    return {
      VariableDeclarator(node) {
        collectDescribeAlias(node, describeAliasNames);
      },
      CallExpression(node) {
        collectTestObjectSignal(node, testObjectSignals);

        if (isSlowMethodCall(node)) {
          slowCallCandidates.push(node);
        }
      },
      'Program:exit'() {
        for (const signal of testObjectSignals) {
          // A variable bound to `test.describe` itself, called directly,
          // looks identical to a per-test invocation (`X('name', fn)`) —
          // exclude it so it isn't promoted to a full test-object identity.
          if (
            signal.type === 'directCall' &&
            describeAliasNames.has(signal.name)
          ) {
            continue;
          }

          testObjectIdentifiers.add(signal.name);
        }

        for (const node of slowCallCandidates) {
          const info = getCalleeInfo(node.callee);

          // A null `info` is an unclassifiable callee, which is exactly the
          // "can't prove it's a test object" case the check below skips.
          if (!info || !testObjectIdentifiers.has(info.root)) {
            continue;
          }

          if (
            classifyEnclosingCall(node, testObjectIdentifiers) === 'blanket'
          ) {
            context.report({ node, messageId: 'blanketSlow' });
          }
        }
      },
    };
  },
};

export default rule;
