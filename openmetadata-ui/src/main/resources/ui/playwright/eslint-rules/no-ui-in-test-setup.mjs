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

// UI actions inside test.beforeAll / test.beforeEach / test.afterAll /
// test.afterEach are the single largest driver of per-test SUT stress and
// wall-clock waste. Creating an entity through the UI costs ~30 API calls;
// creating it through the apiContext costs 1. Multiplied across ~4200 tests
// and every re-run, this compounds into the "why do our shards time out?"
// question that Pere's PR #32594 answered (21% of API calls were wasted).
//
// The rule bans a set of user-input Page methods inside the four fixture
// hooks. `page.goto` is intentionally NOT banned — navigating to the URL
// under test is legitimate setup; it is `click`/`fill`/etc. that turn
// setup into a slow UI journey. Tests should push their state via
// `apiContext.<Entity>.create(...)` or a REST helper instead.

const HOOK_NAMES = new Set([
  'beforeAll',
  'beforeEach',
  'afterAll',
  'afterEach',
]);

// The user-input surface of the Playwright Page/Locator API. `goto` is
// deliberately absent — navigation is not a user-input action, and
// forbidding it would flag every legitimate `await page.goto(baseUrl)` in a
// `beforeEach`. If you want to also flag those, do it in a separate rule.
const UI_INPUT_METHODS = new Set([
  'click',
  'dblclick',
  'fill',
  'type',
  'press',
  'selectOption',
  'check',
  'uncheck',
  'setInputFiles',
  'hover',
  'tap',
  'dragAndDrop',
  'focus',
  'blur',
]);

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

// `test.beforeAll(...)` / `test.beforeEach(...)`. A bare `beforeAll(...)`
// call (imported from `@playwright/test` at module scope, no `test.` prefix)
// is intentionally NOT matched — the two projects that use the bare form
// almost always do it in the auth.setup.ts entrypoint, which by design
// performs a real UI login; the rule would fire on the one place we want
// UI-in-setup and miss nothing else, since every spec in this codebase
// uses `test.beforeAll` (not the bare shape).
const isFixtureHookCall = (node) => {
  const { callee } = node;

  if (callee?.type !== 'MemberExpression' || callee.computed) {
    return false;
  }

  const methodName = getMethodName(callee.property, callee.computed);

  return methodName !== null && HOOK_NAMES.has(methodName);
};

const isUiInputCall = (node) => {
  const { callee } = node;

  if (callee?.type !== 'MemberExpression') {
    return false;
  }

  const methodName = getMethodName(callee.property, callee.computed);

  if (methodName === null || !UI_INPUT_METHODS.has(methodName)) {
    return false;
  }

  // Any receiver — `page`, `this.page`, `newPage`, or a Locator variable —
  // is a Playwright surface as long as the method name matches. Narrowing
  // to `page.*` would miss `const el = page.locator(...); el.click()`,
  // which is the exact hoist Pere's positional-locator rule already had
  // to defend against.
  return unwrap(callee.object) !== undefined;
};

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow UI input actions (click/fill/type/…) inside test.beforeAll/beforeEach/afterAll/afterEach — use apiContext for setup instead.',
    },
    schema: [],
    messages: {
      uiInSetup:
        'UI action `{{method}}` inside `{{hook}}` — set up test state via apiContext.<Entity>.create() or a REST helper. Every UI click in setup adds ~30 API calls to the SUT (see PR #32594); over ~4200 tests this compounds into timeouts we then call "flakiness".',
    },
  },

  create(context) {
    // A stack of the hook currently being visited (top = innermost). Empty
    // when the traversal is outside any fixture hook, so plain test body
    // calls don't fire — those are exactly where UI clicks belong.
    const hookStack = [];

    return {
      CallExpression(node) {
        if (isFixtureHookCall(node)) {
          const hookName = getMethodName(
            node.callee.property,
            node.callee.computed
          );
          hookStack.push(hookName);

          return;
        }

        if (hookStack.length === 0) {
          return;
        }

        if (isUiInputCall(node)) {
          const methodName = getMethodName(
            node.callee.property,
            node.callee.computed
          );
          context.report({
            node,
            messageId: 'uiInSetup',
            data: {
              method: methodName,
              hook: hookStack[hookStack.length - 1],
            },
          });
        }
      },
      'CallExpression:exit'(node) {
        if (isFixtureHookCall(node)) {
          hookStack.pop();
        }
      },
    };
  },
};

export default rule;
