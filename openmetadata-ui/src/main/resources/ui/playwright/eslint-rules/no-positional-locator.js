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

const POSITIONAL = new Set(['first', 'last', 'nth']);
const ZERO_ARG_METHODS = new Set(['first', 'last']);

// The three receiver shapes a Playwright Locator reference actually takes in
// this codebase: the tail of an inline chain (`page.locator('x').first()`),
// a locator hoisted into a variable (`const rows = page.locator('x'); rows.first()`),
// and a locator stored as a property (`this.nameLink.first()`). A
// call-expression-only receiver check is trivially evaded by hoisting the
// locator into a variable first, so all three shapes must be covered.
const LOCATOR_RECEIVER_TYPES = new Set([
  'CallExpression',
  'Identifier',
  'MemberExpression',
]);

/**
 * Argument count discriminates the real Playwright API from same-named
 * calls that share a method name but not the shape — e.g. lodash's
 * `_.first(arr)`, which always passes the collection explicitly. Playwright's
 * `.first()` / `.last()` take zero arguments; `.nth(index)` takes exactly one.
 */
const hasPositionalArity = (node, methodName) =>
  ZERO_ARG_METHODS.has(methodName)
    ? node.arguments.length === 0
    : node.arguments.length === 1;

const isPositionalLocatorCall = (node) => {
  const { callee } = node;

  if (callee?.type !== 'MemberExpression') {
    return false;
  }

  const methodName = callee.property?.name;

  return (
    POSITIONAL.has(methodName) &&
    LOCATOR_RECEIVER_TYPES.has(callee.object?.type) &&
    hasPositionalArity(node, methodName)
  );
};

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow positional locators (.first(), .last(), .nth())',
    },
    schema: [],
    messages: {
      positional:
        'Positional locators break when the page changes — Playwright may act on an element you did not intend. Narrow the locator instead: .filter({ hasText }), getByRole with a name, or getRowByName() from playwright/utils/scopedLocators.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        if (isPositionalLocatorCall(node)) {
          context.report({ node, messageId: 'positional' });
        }
      },
    };
  },
};
