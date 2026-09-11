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
        'Disallow accumulating into outer-scope state from beforeAll — the hook runs once per test group, not once per worker',
    },
    schema: [],
    messages: {
      accumulatingBeforeAll:
        "`{{name}}` is declared outside this beforeAll and pushed into without being reset first. Under fullyParallel, Playwright runs beforeAll/afterAll once per *group* of this file's tests dispatched to a worker, so one worker can run beforeAll → tests → afterAll → beforeAll → tests. The array then still holds entities the intervening afterAll deleted, and a positional read like `{{name}}[i]` resolves to an FQN the backend no longer has. Reset it first (`{{name}} = []`) or build it with an assignment.",
    },
  },

  // Scope: this matches the shape that caused the merge queue's top flake — an
  // array declared in the describe/module scope, appended to inside beforeAll,
  // never reassigned there. It deliberately does not try to prove the array is
  // later read by index; any state that survives a teardown is wrong regardless
  // of how it is read. It cannot see through a helper that does the pushing on
  // the hook's behalf, so it is a floor, not a proof.
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    const isBeforeAllCall = (node) => {
      const { callee } = node;

      if (callee.type === 'Identifier') {
        return callee.name === 'beforeAll';
      }

      return (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'beforeAll'
      );
    };

    const hookBodyOf = (node) => {
      const [callback] = node.arguments;

      return callback &&
        (callback.type === 'ArrowFunctionExpression' ||
          callback.type === 'FunctionExpression')
        ? callback
        : undefined;
    };

    /** Names the hook reassigns wholesale, in the order the statements run. */
    const collectResets = (hookBody, resetsBefore) => {
      const walk = (node) => {
        if (!node || typeof node.type !== 'string') {
          return;
        }

        if (
          node.type === 'AssignmentExpression' &&
          node.operator === '=' &&
          node.left.type === 'Identifier'
        ) {
          if (!resetsBefore.has(node.left.name)) {
            resetsBefore.set(node.left.name, node.range[0]);
          }
        }

        for (const key of Object.keys(node)) {
          if (key === 'parent') {
            continue;
          }
          const child = node[key];

          if (Array.isArray(child)) {
            child.forEach(walk);
          } else if (child && typeof child.type === 'string') {
            walk(child);
          }
        }
      };

      walk(hookBody.body);
    };

    const isDeclaredInside = (identifierNode, hookBody) => {
      const scope = sourceCode.getScope
        ? sourceCode.getScope(identifierNode)
        : context.getScope();
      let current = scope;

      while (current) {
        const variable = current.variables.find(
          (candidate) => candidate.name === identifierNode.name
        );

        if (variable) {
          return variable.defs.some(
            (def) =>
              def.node.range[0] >= hookBody.range[0] &&
              def.node.range[1] <= hookBody.range[1]
          );
        }
        current = current.upper;
      }

      return false;
    };

    return {
      CallExpression(node) {
        if (!isBeforeAllCall(node)) {
          return;
        }

        const hookBody = hookBodyOf(node);

        if (!hookBody) {
          return;
        }

        const resets = new Map();
        collectResets(hookBody, resets);

        const reportPushes = (current) => {
          if (!current || typeof current.type !== 'string') {
            return;
          }

          if (
            current.type === 'CallExpression' &&
            current.callee.type === 'MemberExpression' &&
            current.callee.property.type === 'Identifier' &&
            current.callee.property.name === 'push' &&
            current.callee.object.type === 'Identifier'
          ) {
            const target = current.callee.object;
            const resetAt = resets.get(target.name);
            const resetBeforeThisPush =
              resetAt !== undefined && resetAt < current.range[0];

            if (!resetBeforeThisPush && !isDeclaredInside(target, hookBody)) {
              context.report({
                node: current,
                messageId: 'accumulatingBeforeAll',
                data: { name: target.name },
              });
            }
          }

          for (const key of Object.keys(current)) {
            if (key === 'parent') {
              continue;
            }
            const child = current[key];

            if (Array.isArray(child)) {
              child.forEach(reportPushes);
            } else if (child && typeof child.type === 'string') {
              reportPushes(child);
            }
          }
        };

        reportPushes(hookBody.body);
      },
    };
  },
};

export default rule;
