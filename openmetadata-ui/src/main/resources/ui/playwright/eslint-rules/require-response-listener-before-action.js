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

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require waitForResponse listeners to be registered before the action that triggers them',
    },
    schema: [],
    messages: {
      listenerAfterAction:
        'Register the response listener before the action: `const res = page.waitForResponse(url); await locator.click(); await res;` — or use clickAndWaitFor() from playwright/utils/waitHelpers. Awaiting waitForResponse directly races the response that already fired.',
    },
  },

  create(context) {
    return {
      AwaitExpression(node) {
        const call = node.argument;

        if (
          call?.type !== 'CallExpression' ||
          call.callee?.type !== 'MemberExpression' ||
          call.callee.property?.name !== 'waitForResponse'
        ) {
          return;
        }

        context.report({ node: call, messageId: 'listenerAfterAction' });
      },
    };
  },
};
