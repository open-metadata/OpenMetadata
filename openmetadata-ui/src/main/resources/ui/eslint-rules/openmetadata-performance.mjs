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
    const lazyBindings = new Set();
    const reactBindings = new Set();
    const suspenseBindings = new Set();
    const wrappedLazyBindings = new Set();
    const wrapperBindings = new Set();
    const unwrappedLazyCalls = [];
    let hasExplicitSuspenseFallback = false;

    function trackImport(node) {
      if (node.source.value === 'react') {
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.name === 'lazy'
          ) {
            lazyBindings.add(specifier.local.name);
          } else if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.name === 'Suspense'
          ) {
            suspenseBindings.add(specifier.local.name);
          } else if (
            specifier.type === 'ImportDefaultSpecifier' ||
            specifier.type === 'ImportNamespaceSpecifier'
          ) {
            reactBindings.add(specifier.local.name);
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
          wrapperBindings.add(specifier.local.name);
        }
      }
    }

    function isLazyCall(node) {
      if (node.callee.type === 'Identifier') {
        return lazyBindings.has(node.callee.name);
      }

      return (
        node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.object.type === 'Identifier' &&
        reactBindings.has(node.callee.object.name) &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'lazy'
      );
    }

    function isWrapped(node) {
      const parent = node.parent;

      return (
        parent.type === 'CallExpression' &&
        parent.callee.type === 'Identifier' &&
        wrapperBindings.has(parent.callee.name) &&
        parent.arguments.includes(node)
      );
    }

    function trackWrappedBinding(node) {
      if (
        node.callee.type === 'Identifier' &&
        wrapperBindings.has(node.callee.name)
      ) {
        for (const argument of node.arguments) {
          if (argument.type === 'Identifier') {
            wrappedLazyBindings.add(argument.name);
          }
        }
      }
    }

    function isWrappedBinding(node) {
      return (
        node.parent.type === 'VariableDeclarator' &&
        node.parent.id.type === 'Identifier' &&
        wrappedLazyBindings.has(node.parent.id.name)
      );
    }

    function trackSuspenseFallback(node) {
      const isNamedSuspense =
        node.name.type === 'JSXIdentifier' &&
        suspenseBindings.has(node.name.name);
      const isReactSuspense =
        node.name.type === 'JSXMemberExpression' &&
        node.name.object.type === 'JSXIdentifier' &&
        reactBindings.has(node.name.object.name) &&
        node.name.property.type === 'JSXIdentifier' &&
        node.name.property.name === 'Suspense';
      const hasFallback = node.attributes.some(
        (attribute) =>
          attribute.type === 'JSXAttribute' &&
          attribute.name.name === 'fallback'
      );

      if ((isNamedSuspense || isReactSuspense) && hasFallback) {
        hasExplicitSuspenseFallback = true;
      }
    }

    return {
      ImportDeclaration: trackImport,
      CallExpression(node) {
        trackWrappedBinding(node);

        if (isLazyCall(node) && !isWrapped(node)) {
          unwrappedLazyCalls.push(node);
        }
      },
      JSXOpeningElement: trackSuspenseFallback,
      'Program:exit'() {
        if (!hasExplicitSuspenseFallback) {
          for (const node of unwrappedLazyCalls) {
            if (!isWrappedBinding(node)) {
              context.report({ messageId: 'missingSuspenseFallback', node });
            }
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
    const candidates = [];
    const comparisons = [];
    const calls = [];

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
        candidates.push({ name: node.id.name, node });
      }
    }

    function isSizeMember(node, name) {
      return (
        node.type === 'MemberExpression' &&
        !node.computed &&
        node.object.type === 'Identifier' &&
        node.object.name === name &&
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

    function hasSizeGuard(name) {
      return comparisons.some((node) => {
        const sizeOnLeft =
          ['>', '>='].includes(node.operator) &&
          isSizeMember(node.left, name) &&
          isLimit(node.right);
        const sizeOnRight =
          ['<', '<='].includes(node.operator) &&
          isLimit(node.left) &&
          isSizeMember(node.right, name);

        return sizeOnLeft || sizeOnRight;
      });
    }

    function hasEviction(name) {
      return calls.some((node) => {
        const callee = node.callee;

        return (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.object.name === name &&
          callee.property.type === 'Identifier' &&
          ['clear', 'delete'].includes(callee.property.name)
        );
      });
    }

    return {
      BinaryExpression(node) {
        comparisons.push(node);
      },
      CallExpression(node) {
        calls.push(node);
      },
      'Program:exit'() {
        for (const candidate of candidates) {
          if (!hasSizeGuard(candidate.name) || !hasEviction(candidate.name)) {
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
