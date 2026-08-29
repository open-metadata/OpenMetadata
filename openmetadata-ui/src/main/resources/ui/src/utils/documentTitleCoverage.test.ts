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

import fs from 'fs';
import path from 'path';

const SRC_ROOT = path.resolve(__dirname, '..');

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '__mocks__',
  'mocks',
  'generated',
  'locale',
]);

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

const isTestFile = (file: string): boolean =>
  file.includes('.test.') || file.includes('.mock.');

const collectSourceFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name)
        ? []
        : collectSourceFiles(fullPath);
    }

    return SOURCE_EXTENSIONS.includes(path.extname(entry.name)) &&
      !isTestFile(entry.name)
      ? [fullPath]
      : [];
  });

const toRelativePath = (file: string): string =>
  path.relative(SRC_ROOT, file).split(path.sep).join('/');

/**
 * A `pageTitle` bound to a quoted string rather than a `t(...)` call. This is
 * how "Task Forms" and "Settings Navigation Page" reached a non-English
 * user's browser tab. Matches `pageTitle="X"` and `pageTitle={'X'}`.
 */
const LITERAL_PAGE_TITLE = /pageTitle=(?:"[^"]*"|\{\s*['"`][^'"`]*['"`]\s*\})/g;

/** The same defect spelled `<DocumentTitle title="X" />`. */
const LITERAL_DOCUMENT_TITLE =
  /<DocumentTitle\b[^>]*?\stitle=(?:"[^"]*"|\{\s*['"`][^'"`]*['"`]\s*\})/gs;

const findLiteralTitles = (file: string): string[] => {
  const contents = fs.readFileSync(file, 'utf8');

  return [
    ...(contents.match(LITERAL_PAGE_TITLE) ?? []),
    ...(contents.match(LITERAL_DOCUMENT_TITLE) ?? []),
  ].map((match) => `${toRelativePath(file)}: ${match.replace(/\s+/g, ' ')}`);
};

const ROUTER_DIRECTORY = path.join(SRC_ROOT, 'components/AppRouter');

/**
 * Route targets are not all reached from a router. Entity detail routes are
 * dispatched through a lazy map keyed by entity type, so the map is a second
 * root for discovery.
 */
const ENTITY_COMPONENT_MAP = 'utils/EntityDetailComponentUtils.tsx';

const LAZY_IMPORT = /import\('([^']+)'\)/g;

/** Relative static imports, used to follow a wrapper to what it renders. */
const STATIC_IMPORT = /^import\s+[\w*{}\s,]+\s+from\s+'(\.[^']+)';/gm;

/**
 * Anything a page can use to put a title on the document.
 *
 * Deliberately matched in usage position rather than as bare words: a page
 * that only *declares* a `pageTitle` prop, or names one of these in a comment
 * or an import, is not setting a title and must not satisfy the guard.
 */
const TITLE_SOURCE = /pageTitle=\{|<DocumentTitle\b|withPageLayout\(/;

/**
 * How far to follow a wrapper that renders another component. Many routed
 * pages are one-line delegators (`ChartDetailsPage` renders `ChartDetails`,
 * which owns the title), and the title genuinely lives one hop away. One hop
 * is enough for every such wrapper in the tree and keeps the check honest —
 * it verifies the delegation instead of trusting an allowlist entry.
 */
const DELEGATION_DEPTH = 1;

/**
 * Routed modules that legitimately set no title anywhere in their render
 * tree: app shells and nested routers (they only render other routes), and a
 * transient OAuth redirect that is gone before a title could be read.
 */
const MODULES_WITHOUT_OWN_TITLE = new Set([
  'components/AppRouter/AuthenticatedApp.tsx',
  'components/AppRouter/ContextCenterRouter/ContextCenterRouter.tsx',
  'components/Auth/AppCallbacks/Auth0Callback/Auth0Callback.tsx',
  'components/platform/ai-shell/AppModeRoutes/AppModeRoutes.tsx',
]);

const collectRouterFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectRouterFiles(fullPath);
    }

    return entry.name.endsWith('.tsx') && !isTestFile(entry.name)
      ? [fullPath]
      : [];
  });

/** Resolves a relative specifier, including the `dir/index.tsx` form. */
const resolveSpecifier = (
  specifier: string,
  routerFile: string
): string | undefined => {
  const base = path.resolve(path.dirname(routerFile), specifier);
  const candidates = SOURCE_EXTENSIONS.flatMap((extension) => [
    `${base}${extension}`,
    path.join(base, `index${extension}`),
  ]);

  return candidates.find((candidate) => fs.existsSync(candidate));
};

const collectRoutedModules = (): string[] => {
  const modules = new Set<string>();
  const roots = [
    ...collectRouterFiles(ROUTER_DIRECTORY),
    path.join(SRC_ROOT, ENTITY_COMPONENT_MAP),
  ];

  roots.forEach((rootFile) => {
    const contents = fs.readFileSync(rootFile, 'utf8');

    [...contents.matchAll(LAZY_IMPORT)]
      .map(([, specifier]) => specifier)
      .filter((specifier) => specifier.startsWith('.'))
      .forEach((specifier) => {
        const file = resolveSpecifier(specifier, rootFile);

        if (file) {
          modules.add(toRelativePath(file));
        }
      });
  });

  return [...modules];
};

/**
 * Whether `module` sets a title itself, or renders something that does.
 * Following the render one hop is what lets a one-line delegator pass on the
 * strength of its target rather than on an allowlist entry.
 */
const setsDocumentTitle = (module: string, depth: number): boolean => {
  const file = path.join(SRC_ROOT, module);
  const contents = fs.readFileSync(file, 'utf8');

  if (TITLE_SOURCE.test(contents)) {
    return true;
  }

  if (depth === 0) {
    return false;
  }

  return [
    ...[...contents.matchAll(STATIC_IMPORT)].map(([, specifier]) => specifier),
    ...[...contents.matchAll(LAZY_IMPORT)].map(([, specifier]) => specifier),
  ]
    .filter((specifier) => specifier.startsWith('.'))
    .some((specifier) => {
      const target = resolveSpecifier(specifier, file);

      return (
        target !== undefined &&
        setsDocumentTitle(toRelativePath(target), depth - 1)
      );
    });
};

/**
 * Drift guards for browser tab titles.
 *
 * Routes are JSX `<Route>` elements, so there is no route table to walk.
 * These two checks cover the same ground from the source side: every routed
 * page must set a title, and no title may be a hardcoded English string.
 */
describe('document title coverage', () => {
  it('sets every document title through i18n, never a string literal', () => {
    const offenders = collectSourceFiles(SRC_ROOT).flatMap(findLiteralTitles);

    expect(offenders).toEqual([]);
  });

  describe('routed pages', () => {
    const routedModules = collectRoutedModules();

    it('finds the routed page modules', () => {
      expect(routedModules.length).toBeGreaterThan(100);
    });

    it('gives every routed page a title source', () => {
      const untitled = routedModules
        .filter((module) => !MODULES_WITHOUT_OWN_TITLE.has(module))
        .filter((module) => !setsDocumentTitle(module, DELEGATION_DEPTH));

      expect(untitled).toEqual([]);
    });
  });
});
