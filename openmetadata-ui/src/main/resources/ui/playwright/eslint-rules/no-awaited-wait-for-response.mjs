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

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow awaiting page.waitForResponse() directly — register the listener before the action instead',
    },
    schema: [],
    messages: {
      awaitedWaitForResponse:
        'Register the response listener before the action: `const res = page.waitForResponse(url); await locator.click(); await res;` — or use clickAndWaitFor() from playwright/utils/waitHelpers. Awaiting waitForResponse directly races the response that already fired.',
    },
  },

  // Scope, stated plainly: this bans the inline `await …waitForResponse(…)`
  // shape. It performs no ordering analysis — it cannot see which statement
  // triggered the response, so it does not verify that a hoisted listener was
  // registered before its action. Banning the inline form is a sound proxy,
  // because hoisting is the only way to register first, but the gap is real:
  // an aliased call (`const wait = page.waitForResponse.bind(page)`) is not
  // matched. Do not read the rule as proving ordering.
  create(context) {
    return {
      AwaitExpression(node) {
        const call = node.argument;

        if (
          call?.type !== 'CallExpression' ||
          call.callee?.type !== 'MemberExpression' ||
          call.callee.property.type !== 'Identifier' ||
          call.callee.property.name !== 'waitForResponse'
        ) {
          return;
        }

        context.report({ node: call, messageId: 'awaitedWaitForResponse' });
      },
    };
  },
};

export default rule;
