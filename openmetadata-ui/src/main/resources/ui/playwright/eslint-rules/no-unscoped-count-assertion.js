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

/** A locator chain is scoped when it is narrowed by filter/getByRole/hasText. */
const SCOPING_METHODS = new Set(['filter', 'getByRole', 'getByText', 'getByLabel']);

const isScoped = (node) => {
  for (let current = node; current; current = current.callee?.object) {
    if (
      current.type === 'CallExpression' &&
      SCOPING_METHODS.has(current.callee?.property?.name)
    ) {
      return true;
    }
  }

  return false;
};

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow toHaveCount() with a positive literal on an unscoped locator',
    },
    schema: [],
    messages: {
      unscopedCount:
        'Asserting a global element count passes only while no other data exists. Use a measured baseline (toHaveCount(rowsBefore + 1)) or scope the locator to your own entity with .filter({ hasText: name }).',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        if (node.callee?.property?.name !== 'toHaveCount') {
          return;
        }

        const [arg] = node.arguments;

        // Only positive integer literals are unsafe. `toHaveCount(0)` asserts
        // absence, and a computed argument is already relative to a baseline.
        if (arg?.type !== 'Literal' || typeof arg.value !== 'number' || arg.value < 1) {
          return;
        }

        const expectCall = node.callee.object;

        if (
          expectCall?.type === 'CallExpression' &&
          expectCall.callee?.name === 'expect' &&
          !isScoped(expectCall.arguments[0])
        ) {
          context.report({ node, messageId: 'unscopedCount' });
        }
      },
    };
  },
};
