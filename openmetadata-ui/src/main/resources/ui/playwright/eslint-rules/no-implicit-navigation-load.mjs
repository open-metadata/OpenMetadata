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
        'Wait for DOM readiness and assert application state instead of waiting for unrelated page resources',
    },
    schema: [],
    messages: {
      navigationLoad:
        "Use an explicit waitUntil: 'domcontentloaded' (or 'commit') and assert the destination UI/API state. The default load event can hang on unrelated external resources.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression' || node.callee.computed)
          return;
        const method = node.callee.property.name;
        if (
          ![
            'goto',
            'reload',
            'goBack',
            'goForward',
            'waitForURL',
            'waitForLoadState',
          ].includes(method)
        )
          return;
        const optionsIndex = ['goto', 'waitForURL'].includes(method) ? 1 : 0;
        const options = node.arguments[optionsIndex];
        const waitUntil =
          method === 'waitForLoadState'
            ? options
            : options?.type === 'ObjectExpression'
            ? options.properties.find(
                (property) =>
                  property.type === 'Property' &&
                  !property.computed &&
                  (property.key.name ?? property.key.value) === 'waitUntil'
              )?.value
            : undefined;
        if (
          waitUntil?.type === 'Literal' &&
          ['domcontentloaded', 'commit'].includes(waitUntil.value)
        )
          return;
        context.report({ node, messageId: 'navigationLoad' });
      },
    };
  },
};
