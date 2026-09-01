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

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import ts from 'typescript';

const SOURCE_EXTENSION = /\.(?:js|jsx|ts|tsx)$/;
const TEST_FILE = /\.(?:test|spec)\.(?:js|jsx|ts|tsx)$/;
const RUNTIME_DEPENDENCY_CACHE_MAX_SIZE = 500;
const SOURCE_ROOT = path.resolve(__dirname, '../..');
const SOURCE_CANDIDATE_SUFFIXES = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx',
];

const METRIC_ROUTE_ENTRIES = [
  'pages/MetricsPage/MetricListPage/MetricListPage.tsx',
  'pages/MetricsPage/AddMetricPage/AddMetricPage.tsx',
  'pages/MetricsPage/MetricDetailsPage/MetricDetailsPage.tsx',
  'components/Metric/MetricVersion/MetricVersion.tsx',
].map((filePath) => path.join(SOURCE_ROOT, filePath));

const GENERIC_LINEAGE_ENTRY = path.join(
  SOURCE_ROOT,
  'components/Lineage/EntityLineageTab/EntityLineageTab.tsx'
);
const EXPLICIT_LEGACY_ROUTE_BOUNDARIES = new Set([GENERIC_LINEAGE_ENTRY]);

const FEATURE_DIRECTORIES = [
  path.join(SOURCE_ROOT, 'components/Lineage'),
  path.join(SOURCE_ROOT, 'components/Metric'),
  path.join(SOURCE_ROOT, 'pages/MetricsPage'),
  path.join(SOURCE_ROOT, 'utils/MetricEntityUtils'),
];

const FEATURE_FILES = [
  path.join(
    SOURCE_ROOT,
    'components/DataAssets/DataAssetsHeader/StatItem.component.tsx'
  ),
  path.join(SOURCE_ROOT, 'context/LimitsProvider/useLimitsStore.ts'),
  path.join(SOURCE_ROOT, 'hoc/LimitWrapper.tsx'),
  path.join(SOURCE_ROOT, 'rest/metricGroupsAPI.ts'),
  path.join(SOURCE_ROOT, 'rest/metricsAPI.ts'),
  path.join(SOURCE_ROOT, 'utils/ToastUtils.ts'),
];

const isLegacyUiModule = (moduleName: string) =>
  moduleName === 'antd' ||
  moduleName.startsWith('antd/') ||
  moduleName === '@ant-design/icons' ||
  moduleName.startsWith('@ant-design/icons/');

const getSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return getSourceFiles(entryPath);
    }

    return SOURCE_EXTENSION.test(entry.name) && !TEST_FILE.test(entry.name)
      ? [entryPath]
      : [];
  });

const isRuntimeImport = (node: ts.ImportDeclaration) => {
  const importClause = node.importClause;

  if (!importClause) {
    return true;
  }

  if (importClause.isTypeOnly) {
    return false;
  }

  if (importClause.name || !importClause.namedBindings) {
    return true;
  }

  return (
    ts.isNamespaceImport(importClause.namedBindings) ||
    importClause.namedBindings.elements.some((element) => !element.isTypeOnly)
  );
};

const visitRuntimeModuleReferences = (
  sourceFile: ts.SourceFile,
  recordModule: (moduleName: string) => void
) => {
  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      isRuntimeImport(node)
    ) {
      recordModule(node.moduleSpecifier.text);
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      !node.isTypeOnly
    ) {
      recordModule(node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      ((ts.isIdentifier(node.expression) &&
        node.expression.text === 'require') ||
        node.expression.kind === ts.SyntaxKind.ImportKeyword)
    ) {
      recordModule(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

const resolveSourceDependency = (filePath: string, moduleName: string) => {
  const importPath = moduleName.startsWith('.')
    ? path.resolve(path.dirname(filePath), moduleName)
    : moduleName.startsWith('@/')
    ? path.resolve(SOURCE_ROOT, moduleName.slice(2))
    : path.resolve(SOURCE_ROOT, moduleName);

  return SOURCE_CANDIDATE_SUFFIXES.map(
    (suffix) => `${importPath}${suffix}`
  ).find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
};

interface RuntimeDependency {
  filePath?: string;
  legacyModule?: string;
}

const runtimeDependencyCache = new Map<string, RuntimeDependency[]>();

const findRuntimeDependencies = (filePath: string) => {
  const cached = runtimeDependencyCache.get(filePath);
  if (cached) {
    return cached;
  }

  const source = readFileSync(filePath, 'utf8');
  const runtimeSource = /\.[jt]sx?$/.test(filePath)
    ? ts.transpileModule(source, {
        compilerOptions: {
          allowJs: true,
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: filePath,
      }).outputText
    : source;
  const sourceFile = ts.createSourceFile(
    filePath,
    runtimeSource,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const dependencies: RuntimeDependency[] = [];

  const recordModule = (moduleName: string) => {
    if (isLegacyUiModule(moduleName)) {
      dependencies.push({ legacyModule: moduleName });

      return;
    }

    const dependencyPath = resolveSourceDependency(filePath, moduleName);
    if (dependencyPath) {
      dependencies.push({ filePath: dependencyPath });
    }
  };

  visitRuntimeModuleReferences(sourceFile, recordModule);
  if (runtimeDependencyCache.size >= RUNTIME_DEPENDENCY_CACHE_MAX_SIZE) {
    runtimeDependencyCache.clear();
  }
  runtimeDependencyCache.set(filePath, dependencies);

  return dependencies;
};

const findTransitiveLegacyImports = (entryPath: string) => {
  const pending = [{ filePath: entryPath, trace: [entryPath] }];
  const visited = new Set([entryPath]);
  const violations = new Map<string, string>();

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current) {
      continue;
    }

    for (const dependency of findRuntimeDependencies(current.filePath)) {
      if (dependency.legacyModule) {
        const trace = current.trace
          .map((tracePath) => path.relative(SOURCE_ROOT, tracePath))
          .join(' -> ');
        const violationKey = `${current.filePath}:${dependency.legacyModule}`;
        if (!violations.has(violationKey)) {
          violations.set(
            violationKey,
            `${trace} -> ${dependency.legacyModule}`
          );
        }
      } else if (
        dependency.filePath &&
        !EXPLICIT_LEGACY_ROUTE_BOUNDARIES.has(dependency.filePath) &&
        !visited.has(dependency.filePath)
      ) {
        visited.add(dependency.filePath);
        pending.push({
          filePath: dependency.filePath,
          trace: [...current.trace, dependency.filePath],
        });
      }
    }
  }

  return [...violations.values()];
};

const findLegacyImports = (filePath: string) => {
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const violations: string[] = [];

  const recordModule = (moduleName: string) => {
    if (isLegacyUiModule(moduleName)) {
      violations.push(
        `${path.relative(SOURCE_ROOT, filePath)} -> ${moduleName}`
      );
    }
  };

  visitRuntimeModuleReferences(sourceFile, recordModule);

  return violations;
};

describe('Metric Untitled UI boundary', () => {
  it('resolves internal source aliases before walking route dependencies', () => {
    expect(
      resolveSourceDependency(
        METRIC_ROUTE_ENTRIES[0],
        '@/components/Lineage/LineageSkeleton.component'
      )
    ).toBe(
      path.join(SOURCE_ROOT, 'components/Lineage/LineageSkeleton.component.tsx')
    );
  });

  it('contains no runtime Ant Design imports', () => {
    const metricHookFiles = getSourceFiles(
      path.join(SOURCE_ROOT, 'hooks')
    ).filter((filePath) => path.basename(filePath).startsWith('useMetric'));
    const featureFiles = [
      ...FEATURE_DIRECTORIES.flatMap(getSourceFiles),
      ...FEATURE_FILES,
      ...metricHookFiles,
    ];
    const violations = featureFiles.flatMap(findLegacyImports).sort();

    expect(violations).toEqual([]);
  });

  it('keeps generic lineage as the only out-of-scope legacy route boundary', () => {
    const metricDetailsEntry = path.join(
      SOURCE_ROOT,
      'components/Metric/MetricDetails/MetricDetails.tsx'
    );
    const customLineageEntry = path.join(
      SOURCE_ROOT,
      'components/Lineage/UntitledLineageTab/UntitledLineageTab.component.tsx'
    );

    expect([...EXPLICIT_LEGACY_ROUTE_BOUNDARIES]).toEqual([
      GENERIC_LINEAGE_ENTRY,
    ]);
    expect(findRuntimeDependencies(metricDetailsEntry)).toContainEqual({
      filePath: GENERIC_LINEAGE_ENTRY,
    });
    expect(existsSync(customLineageEntry)).toBe(false);
  });

  it('contains no transitive runtime Ant Design imports outside generic lineage', () => {
    const violations = METRIC_ROUTE_ENTRIES.flatMap(
      findTransitiveLegacyImports
    ).sort();
    const diagnostics = violations.length
      ? [
          `Found ${violations.length} transitive Ant Design boundaries`,
          ...violations.slice(0, 25),
        ]
      : [];

    expect(diagnostics).toEqual([]);
  });
});
