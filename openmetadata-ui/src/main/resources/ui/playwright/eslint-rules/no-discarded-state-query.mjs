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

const methods = new Set([
  'isVisible',
  'isHidden',
  'isEnabled',
  'isDisabled',
  'isChecked',
  'isEditable',
]);

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require locator state queries to be asserted or used; awaiting a boolean alone does not assert or wait for readiness',
    },
    schema: [],
    messages: {
      discarded:
        'The result of {{method}}() is discarded. Use a web-first expect(locator) assertion or consume the boolean explicitly.',
    },
  },
  create(context) {
    return {
      ExpressionStatement(node) {
        const call =
          node.expression.type === 'AwaitExpression'
            ? node.expression.argument
            : node.expression;
        if (
          call.type !== 'CallExpression' ||
          call.callee.type !== 'MemberExpression' ||
          call.callee.computed ||
          !methods.has(call.callee.property.name)
        )
          return;
        context.report({
          node,
          messageId: 'discarded',
          data: { method: call.callee.property.name },
        });
      },
    };
  },
};
