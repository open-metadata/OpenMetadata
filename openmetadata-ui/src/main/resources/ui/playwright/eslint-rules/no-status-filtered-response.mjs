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

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Assert the status of the first matching response instead of filtering out HTTP failures',
    },
    schema: [],
    messages: {
      statusFilter:
        'Match the request independently of its status, then assert the status. Use waitForResponseWithStatus to preserve the first HTTP failure.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.computed ||
          !['status', 'ok'].includes(node.callee.property.name)
        )
          return;
        let callback = node.parent;
        while (
          callback &&
          !['ArrowFunctionExpression', 'FunctionExpression'].includes(
            callback.type
          )
        )
          callback = callback.parent;
        const wait = callback?.parent;
        if (
          wait?.type !== 'CallExpression' ||
          wait.arguments[0] !== callback ||
          wait.callee.type !== 'MemberExpression' ||
          wait.callee.property.name !== 'waitForResponse'
        )
          return;
        if (
          callback.params[0]?.type !== 'Identifier' ||
          node.callee.object.type !== 'Identifier' ||
          node.callee.object.name !== callback.params[0].name
        )
          return;
        context.report({ node, messageId: 'statusFilter' });
      },
    };
  },
};
