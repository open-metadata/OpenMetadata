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

const isTestCall = (node) =>
  (node.callee?.type === 'Identifier' && node.callee.name === 'test') ||
  (node.callee?.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'test' &&
    node.callee.property.type === 'Identifier' &&
    ['only', 'fixme'].includes(node.callee.property.name));

// `page.getByTestId('x').click()` -> the `page` Identifier.
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

// Fixtures the callback destructures, plus `page` as a fallback for callbacks
// that don't destructure at all.
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

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Flag tests that only perform page interactions and verify nothing',
    },
    schema: [],
    messages: {
      pageInteractionsOnly:
        'This test only performs page interactions (clicks, fills, navigation) and verifies nothing — it can only fail if something throws. Add a web-first assertion, or call a helper that already asserts.',
    },
  },

  create(context) {
    const allCalls = [];
    const testCalls = [];
    // An AST walk, not a source-text scan: `\bexpect\b` also matched the word
    // in comments and strings, silently exempting assertion-free tests.
    const expectRanges = [];

    return {
      Identifier(node) {
        if (node.name === 'expect' && node.range) {
          expectRanges.push(node.range);
        }
      },

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

          const [bodyStart, bodyEnd] = body.range;

          // An `expect` identifier counts, not just a call: `verifyRow(page,
          // expect)` delegates the assertion by reference.
          const hasExpectReference = expectRanges.some(
            ([start, end]) => start >= bodyStart && end <= bodyEnd
          );

          if (hasExpectReference) {
            continue;
          }

          // Flag only when PROVABLY assertion-free: every call must stay on a
          // page/locator fixture chain. A call to a helper or page-object
          // method may assert internally, and proving otherwise needs
          // interprocedural analysis this rule doesn't do, so it exempts the
          // test. Under-reporting is the deliberate bias for a CI-blocking
          // rule — a false alarm costs more than a missed empty test.
          const fixtureNames = getFixtureNames(body);
          const nestedCalls = allCalls.filter((call) => {
            const [callStart, callEnd] = call.range;

            return (
              call !== node && callStart >= bodyStart && callEnd <= bodyEnd
            );
          });
          // `test.*` calls are transparent, not exempting: they can't assert.
          // A `test.step` callback is inline, so its own calls are collected
          // above and judged on their merits — treating the `test.step(...)`
          // call itself as transparent loses no coverage.
          const isTestNamespaceCall = (call) => {
            const root = unwindToRoot(call.callee);

            return root?.type === 'Identifier' && root.name === 'test';
          };
          const isPageInteractionOnly = nestedCalls
            .filter((call) => !isTestNamespaceCall(call))
            .every((call) => {
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

export default rule;
