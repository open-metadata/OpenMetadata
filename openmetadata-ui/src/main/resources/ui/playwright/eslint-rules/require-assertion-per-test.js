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

'use strict';

const isTestCall = (node) =>
  (node.callee?.type === 'Identifier' && node.callee.name === 'test') ||
  (node.callee?.type === 'MemberExpression' &&
    node.callee.object?.name === 'test' &&
    ['only', 'fixme'].includes(node.callee.property?.name));

// Unwinds a (possibly chained) call/member expression back to its root node
// — e.g. `page.getByTestId('x').click()` -> the `page` Identifier — by
// alternating between "step out of a member access" and "step out of a
// call" until neither applies.
const unwindToRoot = (node) => {
  let current = node;

  while (current) {
    if (current.type === 'MemberExpression') {
      current = current.object;
    } else if (current.type === 'CallExpression') {
      current = current.callee;
    } else {
      return current;
    }
  }

  return current;
};

// The identifiers a test body is allowed to call without losing its
// "provably does nothing but interact" status: the Playwright fixtures it
// destructures (`page`, `adminPage`, `context`, ...), plus the conventional
// `page` name as a safety net for callbacks that don't destructure at all.
const getFixtureNames = (body) => {
  const names = new Set(['page']);
  const [param] = body.params;

  if (param?.type === 'ObjectPattern') {
    for (const prop of param.properties) {
      if (prop.type === 'Property' && prop.value?.type === 'Identifier') {
        names.add(prop.value.name);
      }
    }
  }

  return names;
};

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require every test to do more than page interactions with no verification',
    },
    schema: [],
    messages: {
      pageInteractionsOnly:
        'This test only performs page interactions (clicks, fills, navigation) and verifies nothing — it can only fail if something throws. Add a web-first assertion, or call a helper that already asserts.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    // Every CallExpression in the file, collected during the single
    // traversal below, so `Program:exit` can ask "which calls fall inside
    // this test's body?" by range instead of re-walking each body by hand.
    const allCalls = [];
    const testCalls = [];

    return {
      CallExpression(node) {
        allCalls.push(node);

        if (isTestCall(node)) {
          testCalls.push(node);
        }
      },

      'Program:exit'() {
        for (const node of testCalls) {
          const body = node.arguments.find(
            (arg) =>
              arg.type === 'ArrowFunctionExpression' ||
              arg.type === 'FunctionExpression'
          );

          if (!body) {
            continue;
          }

          // A source-text scan, not an AST walk for `expect(...)` calls:
          // this deliberately also matches `expect` passed as a bare
          // identifier (e.g. `await verifyRow(page, expect)`), so
          // assertions delegated to a helper by reference are still seen.
          const hasExpectReference = sourceCode
            .getText(body)
            .match(/\bexpect\b/);

          if (hasExpectReference) {
            continue;
          }

          // Beyond the text scan, this rule can only flag a test when it is
          // PROVABLY assertion-free: no `expect` reference anywhere, AND
          // every call in the body stays on a Playwright page/locator
          // fixture chain (`page.getByTestId(...).click()`). Any call to an
          // imported function or a page-object method
          // (`entity.descriptionUpdate(page)`, `addUser(...)`,
          // `verifyAuthenticated(...)`) may assert internally, and proving
          // otherwise would need interprocedural analysis this rule doesn't
          // do — so such a call exempts the whole test. Under-reporting is
          // the deliberate, correct bias for a rule wired to block CI: a
          // missed truly-empty test costs nothing but a moment's
          // inattention, while a wrongly flagged delegating test costs a
          // developer's time proving a false alarm.
          const fixtureNames = getFixtureNames(body);
          const nestedCalls = allCalls.filter(
            (call) =>
              call !== node &&
              call.range[0] >= body.range[0] &&
              call.range[1] <= body.range[1]
          );
          const isPageInteractionOnly = nestedCalls.every((call) => {
            const root = unwindToRoot(call.callee);

            return root?.type === 'Identifier' && fixtureNames.has(root.name);
          });

          if (isPageInteractionOnly) {
            context.report({ node, messageId: 'pageInteractionsOnly' });
          }
        }
      },
    };
  },
};
