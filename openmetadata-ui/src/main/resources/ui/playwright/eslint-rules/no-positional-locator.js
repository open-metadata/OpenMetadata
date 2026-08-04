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

/**
 * Only flags calls whose receiver is itself a call expression — i.e. the tail of
 * a locator chain such as `page.locator('x').first()`. That excludes array
 * `.at()`-style usage and bare property reads, which share the method names but
 * are not Playwright positional selectors.
 */
const isLocatorChainTail = (node) =>
  node.callee?.type === 'MemberExpression' &&
  POSITIONAL.has(node.callee.property?.name) &&
  node.callee.object?.type === 'CallExpression';

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
        if (isLocatorChainTail(node)) {
          context.report({ node, messageId: 'positional' });
        }
      },
    };
  },
};
