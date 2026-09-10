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
        'Reset arrays populated by beforeAll before appending fixtures from a new test group',
    },
    schema: [],
    messages: {
      staleFixtures:
        'Reset {{name}} at the start of beforeAll. Playwright can reuse this worker for another group after afterAll deleted the previous fixtures.',
    },
  },
  create(context) {
    const source = context.sourceCode;
    const reported = new WeakMap();
    const resolve = (node) => {
      for (let scope = source.getScope(node); scope; scope = scope.upper) {
        const variable = scope.variables.find(
          (entry) => entry.name === node.name
        );
        if (variable) return variable;
      }
      return undefined;
    };
    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression' ||
          !['push', 'unshift'].includes(node.callee.property.name) ||
          node.callee.object.type !== 'Identifier'
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
        // Inner callbacks (forEach/map) still belong to the enclosing hook.
        while (
          callback &&
          !(
            callback.parent?.type === 'CallExpression' &&
            callback.parent.callee.type === 'MemberExpression' &&
            callback.parent.callee.property.name === 'beforeAll'
          )
        ) {
          callback = callback.parent;
        }
        if (!callback) return;
        const variable = resolve(node.callee.object);
        const declaration = variable?.defs[0]?.node;
        if (
          declaration?.type !== 'VariableDeclarator' ||
          declaration.init?.type !== 'ArrayExpression' ||
          (declaration.range[0] >= callback.range[0] &&
            declaration.range[1] <= callback.range[1])
        )
          return;
        const statements =
          callback.body.type === 'BlockStatement' ? callback.body.body : [];
        const resets = statements.some((statement) => {
          if (
            statement.range[0] >= node.range[0] ||
            statement.type !== 'ExpressionStatement'
          )
            return false;
          const expression = statement.expression;
          if (
            expression.type !== 'AssignmentExpression' ||
            expression.operator !== '='
          )
            return false;
          if (expression.left.type === 'Identifier')
            return (
              resolve(expression.left) === variable &&
              expression.right.type === 'ArrayExpression'
            );
          return (
            expression.left.type === 'MemberExpression' &&
            expression.left.property.name === 'length' &&
            expression.left.object.type === 'Identifier' &&
            resolve(expression.left.object) === variable &&
            expression.right.type === 'Literal' &&
            expression.right.value === 0
          );
        });
        const previous = reported.get(callback) ?? new Set();
        if (!resets && !previous.has(variable)) {
          context.report({
            node,
            messageId: 'staleFixtures',
            data: { name: variable.name },
          });
          previous.add(variable);
          reported.set(callback, previous);
        }
      },
    };
  },
};

export default rule;
