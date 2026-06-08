/*
 *  Copyright 2025 Collate.
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

/**
 * ESLint rule to detect duplicate API calls within the same React component or file.
 * This is an anti-pattern that can cause:
 * - Performance issues
 * - Unnecessary network traffic
 * - Race conditions
 * - Inconsistent state management
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow duplicate API calls in the same component/file (anti-pattern)',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      duplicateApiCall:
        'Duplicate API call detected: "{{ apiCall }}" is called {{ count }} times in this {{ scope }}. Consider consolidating these calls or using shared state/caching.',
      duplicateEndpoint:
        'Duplicate endpoint detected: "{{ endpoint }}" is called from {{ count }} different locations in this {{ scope }}. Consider creating a custom hook or service.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          threshold: {
            type: 'integer',
            minimum: 2,
            default: 2,
            description:
              'Number of duplicate calls before reporting (default: 2)',
          },
          checkUseEffect: {
            type: 'boolean',
            default: true,
            description:
              'Check for duplicates across multiple useEffect hooks (default: true)',
          },
          checkCallbacks: {
            type: 'boolean',
            default: true,
            description:
              'Check for duplicates in event handlers and callbacks (default: true)',
          },
          allowedDuplicates: {
            type: 'array',
            items: {
              type: 'string',
            },
            description:
              'List of API function names that are allowed to be called multiple times',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const threshold = options.threshold || 2;
    const checkUseEffect = options.checkUseEffect !== false;
    const checkCallbacks = options.checkCallbacks !== false;
    const allowedDuplicates = new Set(options.allowedDuplicates || []);

    const apiCallPatterns = [
      'searchQuery',
      'fetch',
      'axios',
      'APIClient',
      /get[A-Z]\w+ByName/,
      /get[A-Z]\w+ById/,
      /get[A-Z]\w+ByFqn/,
      /fetch[A-Z]\w+/,
      /load[A-Z]\w+/,
      /create[A-Z]\w+/,
      /update[A-Z]\w+/,
      /delete[A-Z]\w+/,
      /patch[A-Z]\w+/,
    ];

    function isApiCall(node) {
      if (node.type === 'CallExpression') {
        const callee = node.callee;

        if (callee.type === 'Identifier') {
          const name = callee.name;

          return apiCallPatterns.some((pattern) => {
            if (typeof pattern === 'string') {
              return name === pattern;
            }

            return pattern.test(name);
          });
        }

        if (callee.type === 'MemberExpression') {
          const objectName = callee.object.name;
          const propertyName = callee.property.name;
          const fullName = `${objectName}.${propertyName}`;

          return (
            objectName === 'axios' ||
            objectName === 'APIClient' ||
            ['get', 'post', 'put', 'patch', 'delete'].includes(propertyName) ||
            apiCallPatterns.some((pattern) => {
              if (typeof pattern === 'string') {
                return fullName.includes(pattern);
              }

              return pattern.test(propertyName);
            })
          );
        }
      }

      return false;
    }

    function getCallSignature(node) {
      const callee = node.callee;
      let signature = '';

      if (callee.type === 'Identifier') {
        signature = callee.name;
      } else if (callee.type === 'MemberExpression') {
        const obj = callee.object.name || '';
        const prop = callee.property.name || '';
        signature = `${obj}.${prop}`;
      }

      if (node.arguments.length > 0) {
        const firstArg = node.arguments[0];
        if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
          signature += `("${firstArg.value}")`;
        } else if (firstArg.type === 'TemplateLiteral') {
          const parts = firstArg.quasis
            .map((q) => q.value.cooked)
            .join('${...}');
          signature += `(\`${parts}\`)`;
        } else if (firstArg.type === 'ObjectExpression') {
          const props = firstArg.properties
            .slice(0, 2)
            .map((p) => {
              if (p.key) {
                return p.key.name || p.key.value;
              }

              return '';
            })
            .filter(Boolean);
          signature += `({${props.join(', ')}${
            firstArg.properties.length > 2 ? ', ...' : ''
          }})`;
        }
      }

      return signature;
    }

    function getApiFunction(node) {
      const callee = node.callee;
      if (callee.type === 'Identifier') {
        return callee.name;
      } else if (callee.type === 'MemberExpression') {
        return callee.property.name || '';
      }

      return '';
    }

    let currentComponent = null;
    const componentStack = [];

    function checkDuplicates(callsMap, scope) {
      for (const [signature, data] of callsMap.entries()) {
        if (data.count >= threshold) {
          data.nodes.forEach((node, index) => {
            if (index > 0) {
              context.report({
                node,
                messageId: 'duplicateApiCall',
                data: {
                  apiCall: signature,
                  count: data.count,
                  scope,
                },
              });
            }
          });
        }
      }
    }

    return {
      'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(node) {
        const parent = node.parent;
        const isComponent =
          (parent.type === 'VariableDeclarator' &&
            parent.id.name &&
            /^[A-Z]/.test(parent.id.name)) ||
          (node.type === 'FunctionDeclaration' &&
            node.id &&
            /^[A-Z]/.test(node.id.name)) ||
          (parent.type === 'Property' &&
            parent.key.name &&
            /^[A-Z]/.test(parent.key.name));

        if (isComponent) {
          componentStack.push({
            name:
              node.id?.name ||
              parent.id?.name ||
              parent.key?.name ||
              'Anonymous',
            calls: new Map(),
          });
          currentComponent = componentStack[componentStack.length - 1];
        }
      },

      'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression:exit'(
        node
      ) {
        const parent = node.parent;
        const isComponent =
          (parent.type === 'VariableDeclarator' &&
            parent.id.name &&
            /^[A-Z]/.test(parent.id.name)) ||
          (node.type === 'FunctionDeclaration' &&
            node.id &&
            /^[A-Z]/.test(node.id.name)) ||
          (parent.type === 'Property' &&
            parent.key.name &&
            /^[A-Z]/.test(parent.key.name));

        if (isComponent && componentStack.length > 0) {
          const component = componentStack.pop();
          checkDuplicates(component.calls, `component "${component.name}"`);

          if (componentStack.length === 0) {
            currentComponent = null;
          } else {
            currentComponent = componentStack[componentStack.length - 1];
          }
        }
      },

      CallExpression(node) {
        if (isApiCall(node)) {
          if (currentComponent) {
            if (!currentComponent.calls.has('global')) {
              currentComponent.calls.set('global', new Map());
            }
            const callsMap = currentComponent.calls.get('global');
            const signature = getCallSignature(node);
            const apiFunction = getApiFunction(node);

            if (allowedDuplicates.has(apiFunction)) {
              return;
            }

            if (!callsMap.has(signature)) {
              callsMap.set(signature, {
                count: 0,
                nodes: [],
                apiFunction,
              });
            }

            const entry = callsMap.get(signature);
            entry.count++;
            entry.nodes.push(node);
          }
        }
      },
    };
  },
};
