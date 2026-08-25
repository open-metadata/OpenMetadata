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
import type { Rule } from 'eslint';
import type {
  ArrowFunctionExpression,
  CallExpression,
  FunctionExpression,
  Node,
} from 'estree';

type TestBody = ArrowFunctionExpression | FunctionExpression;

const isTestCall = (node: CallExpression): boolean =>
  (node.callee?.type === 'Identifier' && node.callee.name === 'test') ||
  (node.callee?.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'test' &&
    node.callee.property.type === 'Identifier' &&
    ['only', 'fixme'].includes(node.callee.property.name));

// Unwinds a (possibly chained) call/member expression back to its root node
// — e.g. `page.getByTestId('x').click()` -> the `page` Identifier — by
// alternating between "step out of a member access" and "step out of a
// call" until neither applies.
const unwindToRoot = (
  node: Node | null | undefined
): Node | null | undefined => {
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
const getFixtureNames = (body: TestBody): Set<string> => {
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

const rule: Rule.RuleModule = {
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
    // Every CallExpression in the file, collected during the single
    // traversal below, so `Program:exit` can ask "which calls fall inside
    // this test's body?" by range instead of re-walking each body by hand.
    const allCalls: (CallExpression & Rule.NodeParentExtension)[] = [];
    const testCalls: (CallExpression & Rule.NodeParentExtension)[] = [];
    // Ranges of every real `expect` identifier in the file. An AST walk, not a
    // source-text scan: `\bexpect\b` also matched the word inside comments and
    // string literals, so `// we expect the click to work` or a URL containing
    // "expect" silently exempted an assertion-free test.
    const expectRanges: [number, number][] = [];

    return {
      Identifier(node) {
        if (node.name === 'expect' && node.range) {
          expectRanges.push(node.range as [number, number]);
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
            (arg): arg is TestBody =>
              arg.type === 'ArrowFunctionExpression' ||
              arg.type === 'FunctionExpression'
          );

          if (!body) {
            continue;
          }

          const [bodyStart, bodyEnd] = body.range as [number, number];

          // Any `expect` *identifier* inside the body counts, not just a
          // call: `await verifyRow(page, expect)` delegates the assertion by
          // reference, and flagging that would be a false positive.
          const hasExpectReference = expectRanges.some(
            ([start, end]) => start >= bodyStart && end <= bodyEnd
          );

          if (hasExpectReference) {
            continue;
          }

          // Beyond the expect check, this rule can only flag a test when it is
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
          const nestedCalls = allCalls.filter((call) => {
            const [callStart, callEnd] = call.range as [number, number];

            return (
              call !== node && callStart >= bodyStart && callEnd <= bodyEnd
            );
          });
          // `test.slow()`, `test.setTimeout()`, `test.step()`, and their
          // siblings are transparent, not exempting: they can't assert, so
          // they don't count toward "does something other than interact
          // with the page." A `test.step` callback is inline and fully
          // visible in the same body — unlike a delegated helper there's no
          // interprocedural barrier — so its own calls are already
          // collected above and checked on their own merits; treating the
          // `test.step(...)` call itself as transparent doesn't lose that
          // coverage.
          const isTestNamespaceCall = (call: CallExpression): boolean => {
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
