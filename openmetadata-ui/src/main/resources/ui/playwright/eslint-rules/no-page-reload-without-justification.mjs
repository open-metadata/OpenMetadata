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

// `page.reload()` is the dominant driver of the `appBootsPerUIScenario`
// convergence-target breach (measured 2.3, target ≤1). Every reload boots
// the SPA entry chunk again — which the recordPlaywrightAppBoot beacon in
// src/index.tsx counts via a favicon fetch — so a test with two reloads
// spends most of its budget on boot, not on assertions.
//
// Legit reloads exist (persistence tests, service-worker upgrades, SSO
// return flows) — this rule doesn't ban them, it requires an
// "// TEST_KEEP_RELOAD: <reason>" comment on the line above the call, or
// on the same line as a trailing comment. Justified reloads pass; bare
// reloads fail. Suppressions accrue in eslint-suppressions.json (the
// ratchet used by the other playwright rules), so the current ~158 bare
// reloads are grandfathered and can only shrink.

const RELOAD_JUSTIFICATION = /TEST_KEEP_RELOAD:\s*\S/;

const TRANSPARENT_WRAPPERS = new Set([
  'TSNonNullExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
  'AwaitExpression',
]);

const unwrap = (node) => {
  let current = node;

  while (current && TRANSPARENT_WRAPPERS.has(current.type)) {
    current = current.expression ?? current.argument;
  }

  return current;
};

const getMethodName = (property, computed) => {
  if (!computed && property.type === 'Identifier') {
    return property.name ?? null;
  }
  if (
    computed &&
    property.type === 'Literal' &&
    typeof property.value === 'string'
  ) {
    return property.value;
  }

  return null;
};

// Names commonly used for a Playwright Page in this codebase. This is a
// scope-narrowing heuristic — the rule fires only on `.reload()` calls
// whose receiver looks like a Page. It intentionally under-fires on
// exotic naming (say, `browserTab.reload()`) rather than over-fire on
// domain objects like `store.reload()` or `dataSource.reload()`. The
// same identifier-name approach is used by @typescript-eslint's own
// Page-detection heuristics.
const PAGE_IDENTIFIER_PATTERN = /(^|[a-z_])page$/i;

const isPageReceiver = (receiver) => {
  const inner = unwrap(receiver);
  if (!inner) {
    return false;
  }

  if (inner.type === 'Identifier') {
    // `page`, `p`, `adminPage`, `newPage`, …
    return inner.name === 'p' || PAGE_IDENTIFIER_PATTERN.test(inner.name);
  }
  if (inner.type === 'MemberExpression') {
    // `this.page`, `ctx.page`, `fixture.page`, …
    const prop = getMethodName(inner.property, inner.computed);
    return prop !== null && (prop === 'p' || PAGE_IDENTIFIER_PATTERN.test(prop));
  }
  if (inner.type === 'CallExpression') {
    // `(await browser.newPage()).reload()` — the callee's method name
    // typically ends in `Page` (`newPage`, `createPage`).
    const callee = inner.callee;
    if (callee?.type === 'MemberExpression') {
      const name = getMethodName(callee.property, callee.computed);
      return name !== null && PAGE_IDENTIFIER_PATTERN.test(name);
    }
  }

  return false;
};

const isReloadCall = (node) => {
  const { callee } = node;

  if (callee?.type !== 'MemberExpression') {
    return false;
  }

  const methodName = getMethodName(callee.property, callee.computed);

  if (methodName !== 'reload') {
    return false;
  }

  // reload() takes zero or one options argument. Filters out same-named
  // calls on domain objects (e.g. `.reload(userState, force)` on a store).
  if (node.arguments.length > 1) {
    return false;
  }

  return isPageReceiver(callee.object);
};

const hasJustificationComment = (node, sourceCode) => {
  // Reject strategies that rely on ESLint's comment-to-node attachment
  // (getCommentsBefore/After) — the reload call is nested inside an
  // AwaitExpression inside an ExpressionStatement, so attachment can miss
  // the intended leading comment depending on parser and whitespace. Walk
  // the file's comment list directly and match by line proximity to the
  // reload call: a `// TEST_KEEP_RELOAD:` up to 3 lines above the call, or
  // on the same line as a trailing comment, counts as justification.
  const callLine = node.loc?.start.line ?? -1;
  if (callLine < 0) {
    return false;
  }

  const MAX_LEAD_LINES = 3;

  for (const comment of sourceCode.getAllComments()) {
    if (!RELOAD_JUSTIFICATION.test(comment.value)) {
      continue;
    }
    const commentStart = comment.loc?.start.line ?? -1;
    const commentEnd = comment.loc?.end.line ?? commentStart;
    if (commentStart < 0) {
      continue;
    }

    // Leading comment: ends at most 1 line above the reload, and starts
    // no more than MAX_LEAD_LINES above it.
    if (commentEnd <= callLine && callLine - commentEnd <= MAX_LEAD_LINES) {
      return true;
    }
    // Trailing comment: begins on the same line as the reload.
    if (commentStart === callLine) {
      return true;
    }
  }

  return false;
};

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow page.reload() without a justification comment — each reload boots the SPA again, inflating appBootsPerUIScenario (measured 2.3, target ≤1).',
    },
    schema: [],
    messages: {
      unjustifiedReload:
        'page.reload() adds an SPA boot — every extra boot pushes appBootsPerUIScenario further past its target of ≤1. If this reload is intentional (persistence check, service-worker upgrade, SSO callback), add a comment `// TEST_KEEP_RELOAD: <reason>` on the line above or after the call. Otherwise replace with in-app navigation or trust the app to re-fetch on mutation (a stale UI after mutation is a product bug, not a test workaround).',
    },
  },

  create(context) {
    const { sourceCode } = context;

    return {
      CallExpression(node) {
        if (isReloadCall(node) && !hasJustificationComment(node, sourceCode)) {
          context.report({ node, messageId: 'unjustifiedReload' });
        }
      },
    };
  },
};

export default rule;
