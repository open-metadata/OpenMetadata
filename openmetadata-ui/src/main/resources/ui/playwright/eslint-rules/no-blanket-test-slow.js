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

const isTestSlowCall = (node) =>
  node.callee?.type === 'MemberExpression' &&
  node.callee.object?.name === 'test' &&
  node.callee.property?.name === 'slow';

/**
 * Walks up from the call to find the nearest enclosing function. `test.slow()`
 * is scoped to whatever function encloses it, so a call whose nearest function
 * is a `test(...)` callback affects only that test; anything else (file top
 * level, or a `describe` callback) affects every test beneath it.
 */
const enclosingTestCallback = (node) => {
  for (let current = node.parent; current; current = current.parent) {
    const isFunction =
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'FunctionExpression';

    if (!isFunction) {
      continue;
    }

    const call = current.parent;

    if (call?.type !== 'CallExpression') {
      return null;
    }

    const callee = call.callee;
    const name = callee?.name ?? callee?.object?.name;

    return name === 'test' && callee?.property?.name !== 'describe'
      ? current
      : null;
  }

  return null;
};

module.exports = {
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
    return {
      CallExpression(node) {
        if (!isTestSlowCall(node)) {
          return;
        }

        if (enclosingTestCallback(node) === null) {
          context.report({ node, messageId: 'blanketSlow' });
        }
      },
    };
  },
};
