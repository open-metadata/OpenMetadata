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
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const SOURCE_LAYERS = new Set([
  'components',
  'constants',
  'context',
  'generated',
  'hooks',
  'interface',
  'pages',
  'rest',
  'stores',
  'utils',
]);
const UI_PACKAGES = [
  '@openmetadata/ui-core-components',
  'antd',
  'react',
  'react-dom',
];
const ITERATION_METHODS = new Set([
  'every',
  'filter',
  'flatMap',
  'forEach',
  'map',
  'reduce',
  'some',
]);
const MAX_IMPORT_CACHE_ENTRIES = 4_000;
const importCache = new Map();

function createRule(messages, create) {
  return {
    meta: {
      messages,
      schema: [],
      type: 'problem',
    },
    create,
  };
}

function normalize(file) {
  return path.resolve(file).split(path.sep).join('/');
}

function getSourceRoot(file) {
  const normalized = normalize(file);
  const marker = '/src/';
  const index = normalized.lastIndexOf(marker);

  return index === -1 ? null : normalized.slice(0, index + marker.length - 1);
}

function getLayer(file) {
  const sourceRoot = getSourceRoot(file);

  if (!sourceRoot) {
    return null;
  }

  return (
    normalize(file)
      .slice(sourceRoot.length + 1)
      .split('/')[0] ?? null
  );
}

function getImportPath(importer, source) {
  if (source.startsWith('.')) {
    return normalize(path.resolve(path.dirname(importer), source));
  }

  const sourceRoot = getSourceRoot(importer);
  const [firstSegment] = source.split('/');

  if (sourceRoot && SOURCE_LAYERS.has(firstSegment)) {
    return normalize(path.join(sourceRoot, source));
  }

  if (sourceRoot && source.startsWith('src/')) {
    return normalize(path.join(path.dirname(sourceRoot), source));
  }

  return null;
}

function resolveSourceFile(importer, source) {
  const candidate = getImportPath(importer, source);

  if (!candidate) {
    return null;
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const file = `${candidate}${extension}`;

    if (existsSync(file) && statSync(file).isFile()) {
      return normalize(file);
    }
  }

  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    for (const extension of SOURCE_EXTENSIONS) {
      const file = path.join(candidate, `index${extension}`);

      if (existsSync(file) && statSync(file).isFile()) {
        return normalize(file);
      }
    }
  }

  return null;
}

function getImportedLayer(importer, source) {
  const importedPath = getImportPath(importer, source);

  return importedPath ? getLayer(importedPath) : null;
}

function isTypeOnly(node) {
  if (
    node.type === 'ExportAllDeclaration' ||
    node.type === 'ExportNamedDeclaration'
  ) {
    return node.exportKind === 'type';
  }

  if (node.type !== 'ImportDeclaration') {
    return false;
  }

  return (
    node.importKind === 'type' ||
    (node.specifiers.length > 0 &&
      node.specifiers.every((specifier) => specifier.importKind === 'type'))
  );
}

function getImportVisitors(check) {
  return {
    ExportAllDeclaration: check,
    ExportNamedDeclaration(node) {
      if (node.source) {
        check(node);
      }
    },
    ImportDeclaration: check,
  };
}

function isPureUtilsFile(file) {
  const normalized = normalize(file);

  return (
    /Pure(?:Utils?|Helpers?)\.(?:ts|tsx|js|jsx)$/.test(normalized) ||
    normalized.includes('/pure-utils/')
  );
}

const noImpurePureUtils = createRule(
  {
    impureImport:
      'Pure utilities must not depend on React, UI, state, hooks, pages, or REST clients. Move orchestration/rendering out or move shared types to a lower layer.',
    jsxInPureUtils:
      'Pure utilities must not render JSX. Move this code to a component or renderer and keep PureUtils as a .ts module.',
  },
  (context) => {
    const filename = context.filename;

    if (!isPureUtilsFile(filename)) {
      return {};
    }

    const forbiddenLayers = new Set([
      'components',
      'context',
      'hooks',
      'pages',
      'rest',
      'stores',
    ]);

    function checkImport(node) {
      const source = node.source.value;
      const importsUiPackage = UI_PACKAGES.some(
        (pkg) => source === pkg || source.startsWith(`${pkg}/`)
      );

      if (
        importsUiPackage ||
        forbiddenLayers.has(getImportedLayer(filename, source))
      ) {
        context.report({ messageId: 'impureImport', node });
      }
    }

    return {
      ...getImportVisitors(checkImport),
      JSXElement(node) {
        context.report({ messageId: 'jsxInPureUtils', node });
      },
      JSXFragment(node) {
        context.report({ messageId: 'jsxInPureUtils', node });
      },
    };
  }
);

function createLayerImportRule({ importerLayer, message, targetLayers }) {
  return createRule({ invalidLayerImport: message }, (context) => {
    const filename = context.filename;

    if (getLayer(filename) !== importerLayer) {
      return {};
    }

    return getImportVisitors((node) => {
      if (targetLayers.has(getImportedLayer(filename, node.source.value))) {
        context.report({ messageId: 'invalidLayerImport', node });
      }
    });
  });
}

const noLowerLayerPageImports = createRule(
  {
    lowerLayerImportsPage:
      'Pages are route-level composition modules. Move the shared implementation/type to a lower layer instead of importing a page from here.',
  },
  (context) => {
    const filename = normalize(context.filename);
    const importerLayer = getLayer(filename);

    if (
      !importerLayer ||
      importerLayer === 'pages' ||
      filename.includes('/src/components/AppRouter/')
    ) {
      return {};
    }

    return getImportVisitors((node) => {
      if (getImportedLayer(filename, node.source.value) === 'pages') {
        context.report({ messageId: 'lowerLayerImportsPage', node });
      }
    });
  }
);

const noCrossPageImports = createRule(
  {
    crossPageImport:
      'Page features must not import another page feature. Move shared code to components, hooks, interfaces, or pure utilities.',
  },
  (context) => {
    const filename = normalize(context.filename);
    const sourceRoot = getSourceRoot(filename);

    if (getLayer(filename) !== 'pages' || !sourceRoot) {
      return {};
    }

    const importerFeature = filename
      .slice(`${sourceRoot}/pages/`.length)
      .split('/')[0];

    return getImportVisitors((node) => {
      const importedPath = getImportPath(filename, node.source.value);

      if (!importedPath || getLayer(importedPath) !== 'pages') {
        return;
      }

      const importedFeature = importedPath
        .slice(`${sourceRoot}/pages/`.length)
        .split('/')[0];

      if (importerFeature !== importedFeature) {
        context.report({ messageId: 'crossPageImport', node });
      }
    });
  }
);

const noRestUiImports = createLayerImportRule({
  importerLayer: 'rest',
  message:
    'REST clients must not import UI or state-layer modules. Move shared request/response types to the interface layer.',
  targetLayers: new Set(['components', 'context', 'hooks', 'pages', 'stores']),
});

const noHookUiImports = createLayerImportRule({
  importerLayer: 'hooks',
  message:
    'Hooks must not import components or pages. Move shared logic/types below the UI layer.',
  targetLayers: new Set(['components', 'pages']),
});

const noInternalBarrelImports = createRule(
  {
    internalBarrelImport:
      'Import the internal module directly instead of its index barrel so unrelated siblings do not enter the bundle graph.',
  },
  (context) =>
    getImportVisitors((node) => {
      if (isTypeOnly(node)) {
        return;
      }

      const resolved = resolveSourceFile(context.filename, node.source.value);

      if (
        resolved &&
        /^index\.(?:ts|tsx|js|jsx)$/.test(path.basename(resolved))
      ) {
        context.report({ messageId: 'internalBarrelImport', node });
      }
    })
);

const noLodashDefaultImport = createRule(
  {
    lodashDefaultImport:
      'Import named Lodash members or a direct lodash/<member> module instead of the default or namespace object.',
  },
  (context) => ({
    ImportDeclaration(node) {
      if (
        node.source.value === 'lodash' &&
        node.specifiers.some((specifier) =>
          ['ImportDefaultSpecifier', 'ImportNamespaceSpecifier'].includes(
            specifier.type
          )
        )
      ) {
        context.report({ messageId: 'lodashDefaultImport', node });
      }
    },
  })
);

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

function createApiCallTracker(context) {
  const { sourceCode } = context;
  const apiBindings = new Set();

  function trackImport(node) {
    if (
      isTypeOnly(node) ||
      getImportedLayer(context.filename, node.source.value) !== 'rest'
    ) {
      return;
    }

    for (const specifier of node.specifiers) {
      if (specifier.importKind !== 'type') {
        const variable = findVariable(sourceCode, specifier.local);

        if (variable) {
          apiBindings.add(variable);
        }
      }
    }
  }

  function getRootIdentifier(node) {
    let current = node.callee;

    if (current.type === 'ChainExpression') {
      current = current.expression;
    }

    while (current.type === 'MemberExpression') {
      current = current.object;
    }

    return current.type === 'Identifier' ? current : null;
  }

  function isApiCall(node) {
    const identifier = getRootIdentifier(node);

    return (
      identifier &&
      apiBindings.has(findReferencedVariable(sourceCode, identifier))
    );
  }

  return { isApiCall, trackImport };
}

function isIterationCallback(node) {
  const parent = node.parent;

  return (
    parent?.type === 'CallExpression' &&
    parent.arguments.includes(node) &&
    parent.callee.type === 'MemberExpression' &&
    !parent.callee.computed &&
    parent.callee.property.type === 'Identifier' &&
    ITERATION_METHODS.has(parent.callee.property.name)
  );
}

function isInsideIteration(node) {
  let current = node.parent;

  while (current) {
    if (
      [
        'DoWhileStatement',
        'ForInStatement',
        'ForOfStatement',
        'ForStatement',
        'WhileStatement',
      ].includes(current.type)
    ) {
      return true;
    }

    if (
      [
        'ArrowFunctionExpression',
        'FunctionDeclaration',
        'FunctionExpression',
      ].includes(current.type)
    ) {
      return isIterationCallback(current);
    }

    current = current.parent;
  }

  return false;
}

const noApiCallsInIteration = createRule(
  {
    apiCallInIteration:
      'Avoid issuing one API request per item. Fetch at the data owner, use a bulk endpoint, or use useQueries with an intentional concurrency policy.',
  },
  (context) => {
    const tracker = createApiCallTracker(context);

    return {
      ImportDeclaration: tracker.trackImport,
      CallExpression(node) {
        if (tracker.isApiCall(node) && isInsideIteration(node)) {
          context.report({ messageId: 'apiCallInIteration', node });
        }
      },
    };
  }
);

function getOwningFunction(node) {
  let current = node.parent;

  while (current) {
    if (
      [
        'ArrowFunctionExpression',
        'FunctionDeclaration',
        'FunctionExpression',
      ].includes(current.type)
    ) {
      return current;
    }

    current = current.parent;
  }

  return null;
}

function getExecutionBranches(node, owner) {
  const branches = new Map();
  let current = node;

  while (current.parent && current !== owner) {
    const parent = current.parent;

    if (
      (parent.type === 'IfStatement' ||
        parent.type === 'ConditionalExpression') &&
      (current === parent.consequent || current === parent.alternate)
    ) {
      branches.set(parent, current);
    } else if (
      current.type === 'SwitchCase' &&
      parent.type === 'SwitchStatement'
    ) {
      branches.set(parent, current);
    } else if (parent.type === 'TryStatement' && current !== parent.finalizer) {
      branches.set(parent, current);
    }

    current = parent;
  }

  return branches;
}

function canShareExecutionPath(first, second) {
  for (const [branchPoint, branch] of first.branches) {
    const secondBranch = second.branches.get(branchPoint);

    if (secondBranch && secondBranch !== branch) {
      return false;
    }
  }

  return true;
}

const reviewSequentialApiCalls = createRule(
  {
    sequentialApiCalls:
      'Review these sequential API requests. If they are independent, start them together with Promise.all/Promise.allSettled; keep sequencing only when data-dependent.',
  },
  (context) => {
    const tracker = createApiCallTracker(context);
    const awaitsByFunction = new Map();

    return {
      ImportDeclaration: tracker.trackImport,
      AwaitExpression(node) {
        if (
          node.argument.type !== 'CallExpression' ||
          !tracker.isApiCall(node.argument)
        ) {
          return;
        }

        const owner = getOwningFunction(node);

        if (!owner) {
          return;
        }

        const awaits = awaitsByFunction.get(owner) ?? [];
        awaits.push({ branches: getExecutionBranches(node, owner), node });
        awaitsByFunction.set(owner, awaits);
      },
      'Program:exit'() {
        for (const awaits of awaitsByFunction.values()) {
          for (let index = 1; index < awaits.length; index += 1) {
            const current = awaits[index];
            const hasEarlierCallOnPath = awaits
              .slice(0, index)
              .some((previous) => canShareExecutionPath(previous, current));

            if (hasEarlierCallOnPath) {
              context.report({
                messageId: 'sequentialApiCalls',
                node: current.node,
              });
            }
          }
        }
      },
    };
  }
);

function isTypeOnlyTsImport(node) {
  if (ts.isExportDeclaration(node)) {
    return node.isTypeOnly;
  }

  const clause = node.importClause;

  if (!clause) {
    return false;
  }

  if (clause.isTypeOnly) {
    return true;
  }

  if (clause.name) {
    return false;
  }

  return (
    clause.namedBindings &&
    ts.isNamedImports(clause.namedBindings) &&
    clause.namedBindings.elements.length > 0 &&
    clause.namedBindings.elements.every((element) => element.isTypeOnly)
  );
}

function setImportCache(file, signature, imports) {
  if (!importCache.has(file) && importCache.size >= MAX_IMPORT_CACHE_ENTRIES) {
    importCache.delete(importCache.keys().next().value);
  }

  importCache.set(file, { imports, signature });
}

function readRuntimeImports(file) {
  let fileStat;
  try {
    fileStat = statSync(file);
  } catch {
    return [];
  }

  const signature = `${fileStat.mtimeMs}:${fileStat.size}`;
  const cached = importCache.get(file);

  if (cached?.signature === signature) {
    return cached.imports;
  }

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const imports = [];

  for (const node of sourceFile.statements) {
    const isImport = ts.isImportDeclaration(node);
    const isExport = ts.isExportDeclaration(node);

    if (
      (!isImport && !isExport) ||
      !node.moduleSpecifier ||
      !ts.isStringLiteral(node.moduleSpecifier) ||
      isTypeOnlyTsImport(node)
    ) {
      continue;
    }

    const resolved = resolveSourceFile(file, node.moduleSpecifier.text);

    if (resolved) {
      imports.push(resolved);
    }
  }

  setImportCache(file, signature, imports);

  return imports;
}

function hasImportPath(from, target, visited = new Set()) {
  if (from === target) {
    return true;
  }

  if (visited.has(from)) {
    return false;
  }

  visited.add(from);

  return readRuntimeImports(from).some((dependency) =>
    hasImportPath(dependency, target, visited)
  );
}

const noCircularImports = createRule(
  {
    circularImport:
      'This runtime import participates in a circular dependency. Extract the shared type/constant/utility or invert the dependency.',
  },
  (context) => {
    const filename = normalize(context.filename);

    return getImportVisitors((node) => {
      if (isTypeOnly(node)) {
        return;
      }

      const target = resolveSourceFile(filename, node.source.value);

      if (target && hasImportPath(target, filename)) {
        context.report({ messageId: 'circularImport', node });
      }
    });
  }
);

export default {
  rules: {
    'no-api-calls-in-iteration': noApiCallsInIteration,
    'no-circular-imports': noCircularImports,
    'no-cross-page-imports': noCrossPageImports,
    'no-hook-ui-imports': noHookUiImports,
    'no-impure-pure-utils': noImpurePureUtils,
    'no-internal-barrel-imports': noInternalBarrelImports,
    'no-lodash-default-import': noLodashDefaultImport,
    'no-lower-layer-page-imports': noLowerLayerPageImports,
    'no-rest-ui-imports': noRestUiImports,
    'review-sequential-api-calls': reviewSequentialApiCalls,
  },
};
