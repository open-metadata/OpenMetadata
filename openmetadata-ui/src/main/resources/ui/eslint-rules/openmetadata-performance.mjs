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

const noEagerPageImports = {
  meta: {
    messages: {
      eagerPageImport:
        'Load pages with lazy() and withPageSuspenseFallback() instead of a static runtime import.',
    },
    schema: [],
    type: 'problem',
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const isPageImport = /(^|\/)pages\//.test(node.source.value);
        const isTypeOnly =
          node.importKind === 'type' ||
          (node.specifiers.length > 0 &&
            node.specifiers.every(
              (specifier) => specifier.importKind === 'type'
            ));

        if (isPageImport && !isTypeOnly) {
          context.report({ messageId: 'eagerPageImport', node });
        }
      },
    };
  },
};

function findVariable(sourceCode, identifier) {
  let scope = sourceCode.getScope(identifier);

  while (scope) {
    const variable = scope.set.get(identifier.name);

    if (variable) {
      return variable;
    }

    scope = scope.upper;
  }

  return null;
}

function findReferencedVariable(sourceCode, identifier) {
  let scope = sourceCode.getScope(identifier);

  while (scope) {
    const reference = scope.references.find(
      (candidate) => candidate.identifier === identifier
    );

    if (reference) {
      return reference.resolved;
    }

    scope = scope.upper;
  }

  return null;
}

const requireSuspenseFallback = {
  meta: {
    messages: {
      missingSuspenseFallback:
        'Wrap lazy components with an approved fallback helper or render them under an explicit Suspense fallback.',
    },
    schema: [],
    type: 'problem',
  },
  create(context) {
    const { sourceCode } = context;
    const lazyBindings = new Set();
    const reactBindings = new Set();
    const suspenseBindings = new Set();
    const wrappedLazyBindings = new Set();
    const wrapperBindings = new Set();
    const jsxUsages = [];
    const protectedIdentifiers = new Set();
    const unwrappedLazyCalls = [];
    const variableDependencies = new Map();

    function trackImport(node) {
      if (node.source.value === 'react') {
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.name === 'lazy'
          ) {
            lazyBindings.add(findVariable(sourceCode, specifier.local));
          } else if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.name === 'Suspense'
          ) {
            suspenseBindings.add(findVariable(sourceCode, specifier.local));
          } else if (
            specifier.type === 'ImportDefaultSpecifier' ||
            specifier.type === 'ImportNamespaceSpecifier'
          ) {
            reactBindings.add(findVariable(sourceCode, specifier.local));
          }
        }
      }

      const isWrapperModule = node.source.value.endsWith(
        '/withSuspenseFallback'
      );

      if (!isWrapperModule) {
        return;
      }

      for (const specifier of node.specifiers) {
        const isDefaultImport = specifier.type === 'ImportDefaultSpecifier';
        const isNamedWrapper =
          specifier.type === 'ImportSpecifier' &&
          ['withSuspenseFallback', 'withPageSuspenseFallback'].includes(
            specifier.imported.name
          );

        if (isDefaultImport || isNamedWrapper) {
          wrapperBindings.add(findVariable(sourceCode, specifier.local));
        }
      }
    }

    function isLazyCall(node) {
      if (node.callee.type === 'Identifier') {
        return lazyBindings.has(
          findReferencedVariable(sourceCode, node.callee)
        );
      }

      return (
        node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.object.type === 'Identifier' &&
        reactBindings.has(
          findReferencedVariable(sourceCode, node.callee.object)
        ) &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'lazy'
      );
    }

    function isWrapped(node) {
      const parent = node.parent;

      return (
        parent.type === 'CallExpression' &&
        parent.callee.type === 'Identifier' &&
        wrapperBindings.has(
          findReferencedVariable(sourceCode, parent.callee)
        ) &&
        parent.arguments.includes(node)
      );
    }

    function trackWrappedBinding(node) {
      if (
        node.callee.type === 'Identifier' &&
        wrapperBindings.has(findReferencedVariable(sourceCode, node.callee))
      ) {
        for (const argument of node.arguments) {
          if (argument.type === 'Identifier') {
            wrappedLazyBindings.add(
              findReferencedVariable(sourceCode, argument)
            );
          }
        }
      }
    }

    function isWrappedBinding(node) {
      return (
        node.parent.type === 'VariableDeclarator' &&
        node.parent.id.type === 'Identifier' &&
        wrappedLazyBindings.has(findVariable(sourceCode, node.parent.id))
      );
    }

    function isSuspenseWithFallback(node) {
      const isNamedSuspense =
        node.name.type === 'JSXIdentifier' &&
        suspenseBindings.has(findVariable(sourceCode, node.name));
      const isReactSuspense =
        node.name.type === 'JSXMemberExpression' &&
        node.name.object.type === 'JSXIdentifier' &&
        reactBindings.has(findVariable(sourceCode, node.name.object)) &&
        node.name.property.type === 'JSXIdentifier' &&
        node.name.property.name === 'Suspense';
      const hasFallback = node.attributes.some(
        (attribute) =>
          attribute.type === 'JSXAttribute' &&
          attribute.name.name === 'fallback'
      );

      return (isNamedSuspense || isReactSuspense) && hasFallback;
    }

    function isInsideSuspenseWithFallback(node) {
      let ancestor = node.parent;

      while (ancestor) {
        if (
          ancestor.type === 'JSXElement' &&
          isSuspenseWithFallback(ancestor.openingElement)
        ) {
          return true;
        }

        ancestor = ancestor.parent;
      }

      return false;
    }

    function trackJsxUsage(node) {
      if (node.name.type === 'JSXIdentifier') {
        const variable = findVariable(sourceCode, node.name);

        if (!variable) {
          return;
        }

        const usage = {
          hasFallback: isInsideSuspenseWithFallback(node),
          variable,
        };

        jsxUsages.push(usage);
        if (usage.hasFallback) {
          protectedIdentifiers.add(usage.variable);
        }
      }
    }

    function getOwningVariable(node) {
      let ancestor = node.parent;

      while (ancestor) {
        if (
          ancestor.type === 'VariableDeclarator' &&
          ancestor.id.type === 'Identifier'
        ) {
          return findVariable(sourceCode, ancestor.id);
        }

        ancestor = ancestor.parent;
      }

      return null;
    }

    function trackIdentifier(node) {
      const variable = findReferencedVariable(sourceCode, node);

      if (!variable) {
        return;
      }

      if (isInsideSuspenseWithFallback(node)) {
        protectedIdentifiers.add(variable);
      }

      const owner = getOwningVariable(node);

      if (!owner || owner === variable) {
        return;
      }

      const dependencies = variableDependencies.get(owner) ?? new Set();
      dependencies.add(variable);
      variableDependencies.set(owner, dependencies);
    }

    function getFallbackProtectedBindings() {
      const bindings = new Set(protectedIdentifiers);
      let previousSize = -1;

      while (bindings.size !== previousSize) {
        previousSize = bindings.size;
        for (const variable of [...bindings]) {
          for (const dependency of variableDependencies.get(variable) ?? []) {
            bindings.add(dependency);
          }
        }
      }

      return bindings;
    }

    function isRenderedWithFallback(node, protectedBindings) {
      const owner = getOwningVariable(node);

      if (!owner) {
        return false;
      }

      const usages = jsxUsages.filter((usage) => usage.variable === owner);

      return (
        !usages.some((usage) => !usage.hasFallback) &&
        protectedBindings.has(owner)
      );
    }

    return {
      ImportDeclaration: trackImport,
      CallExpression(node) {
        trackWrappedBinding(node);

        if (isLazyCall(node) && !isWrapped(node)) {
          unwrappedLazyCalls.push(node);
        }
      },
      Identifier: trackIdentifier,
      JSXOpeningElement: trackJsxUsage,
      'Program:exit'() {
        const protectedBindings = getFallbackProtectedBindings();

        for (const node of unwrappedLazyCalls) {
          if (
            !isWrappedBinding(node) &&
            !isRenderedWithFallback(node, protectedBindings)
          ) {
            context.report({ messageId: 'missingSuspenseFallback', node });
          }
        }
      },
    };
  },
};

const noUnboundedModuleCache = {
  meta: {
    messages: {
      unboundedModuleCache:
        'Module-level caches must have an explicit size limit and eviction operation.',
    },
    schema: [],
    type: 'problem',
  },
  create(context) {
    const { sourceCode } = context;
    const candidates = [];
    const calls = [];
    const guards = [];

    function isModuleScope(node) {
      const declarationParent = node.parent.parent;

      return (
        declarationParent.type === 'Program' ||
        (declarationParent.type === 'ExportNamedDeclaration' &&
          declarationParent.parent.type === 'Program')
      );
    }

    function trackCandidate(node) {
      const isCacheName =
        node.id.type === 'Identifier' && /cache|memo/i.test(node.id.name);
      const isCollection =
        node.init?.type === 'NewExpression' &&
        node.init.callee.type === 'Identifier' &&
        ['Map', 'Set'].includes(node.init.callee.name);

      if (isModuleScope(node) && isCacheName && isCollection) {
        candidates.push({
          node,
          variable: findVariable(sourceCode, node.id),
        });
      }
    }

    function isSizeMember(node, variable) {
      return (
        node.type === 'MemberExpression' &&
        !node.computed &&
        node.object.type === 'Identifier' &&
        findReferencedVariable(sourceCode, node.object) === variable &&
        node.property.type === 'Identifier' &&
        node.property.name === 'size'
      );
    }

    function isLimit(node) {
      return (
        (node.type === 'Literal' && typeof node.value === 'number') ||
        (node.type === 'Identifier' && /^[A-Z][A-Z0-9_]*$/.test(node.name))
      );
    }

    function isSizeGuard(node, variable) {
      if (node.type !== 'BinaryExpression') {
        return false;
      }

      const sizeOnLeft =
        ['>', '>='].includes(node.operator) &&
        isSizeMember(node.left, variable) &&
        isLimit(node.right);
      const sizeOnRight =
        ['<', '<='].includes(node.operator) &&
        isLimit(node.left) &&
        isSizeMember(node.right, variable);

      return sizeOnLeft || sizeOnRight;
    }

    function isEviction(node, variable) {
      const callee = node.callee;

      return (
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.object.type === 'Identifier' &&
        findReferencedVariable(sourceCode, callee.object) === variable &&
        callee.property.type === 'Identifier' &&
        ['clear', 'delete'].includes(callee.property.name)
      );
    }

    function isInside(node, ancestor) {
      let current = node.parent;

      while (current) {
        if (current === ancestor) {
          return true;
        }

        if (
          [
            'ArrowFunctionExpression',
            'FunctionDeclaration',
            'FunctionExpression',
          ].includes(current.type)
        ) {
          return false;
        }

        current = current.parent;
      }

      return false;
    }

    function hasBoundedEviction(variable) {
      return guards.some(
        ({ body, test }) =>
          isSizeGuard(test, variable) &&
          calls.some(
            (call) => isEviction(call, variable) && isInside(call, body)
          )
      );
    }

    return {
      CallExpression(node) {
        calls.push(node);
      },
      IfStatement(node) {
        guards.push({ body: node.consequent, test: node.test });
      },
      WhileStatement(node) {
        guards.push({ body: node.body, test: node.test });
      },
      'Program:exit'() {
        for (const candidate of candidates) {
          if (!hasBoundedEviction(candidate.variable)) {
            context.report({
              messageId: 'unboundedModuleCache',
              node: candidate.node,
            });
          }
        }
      },
      VariableDeclarator: trackCandidate,
    };
  },
};

export default {
  rules: {
    'no-eager-page-imports': noEagerPageImports,
    'no-unbounded-module-cache': noUnboundedModuleCache,
    'require-suspense-fallback': requireSuspenseFallback,
  },
};
