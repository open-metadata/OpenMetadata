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
import assert from 'node:assert/strict';
import test, { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';

RuleTester.describe = describe;
RuleTester.it = it;

test('exports the eager page import rule', async () => {
  let performancePlugin;

  try {
    performancePlugin = (await import('./openmetadata-performance.mjs'))
      .default;
  } catch {
    performancePlugin = undefined;
  }

  assert.ok(performancePlugin?.rules?.['no-eager-page-imports']);
});

test('exports the suspense fallback rule', async () => {
  const plugin = (await import('./openmetadata-performance.mjs')).default;

  assert.ok(plugin.rules['require-suspense-fallback']);
});

test('exports the bounded module cache rule', async () => {
  const plugin = (await import('./openmetadata-performance.mjs')).default;

  assert.ok(plugin.rules['no-unbounded-module-cache']);
});

const performancePlugin = (await import('./openmetadata-performance.mjs'))
  .default;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    parser: tseslint.parser,
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
    sourceType: 'module',
  },
});

ruleTester.run(
  'no-eager-page-imports',
  performancePlugin.rules['no-eager-page-imports'],
  {
    valid: [
      {
        code: "import type { PageProps } from '../../pages/ExamplePage';",
        filename: 'src/components/AppRouter/ExampleRouter.tsx',
      },
      {
        code: "import { type PageProps } from '../../pages/ExamplePage';",
        filename: 'src/components/AppRouter/ExampleRouter.tsx',
      },
      {
        code: "const Page = lazy(() => import('../../pages/ExamplePage'));",
        filename: 'src/components/AppRouter/ExampleRouter.tsx',
      },
      {
        code: "import { getPath } from '../../utils/RouterUtils';",
        filename: 'src/components/AppRouter/ExampleRouter.tsx',
      },
    ],
    invalid: [
      {
        code: "import ExamplePage from '../../pages/ExamplePage';",
        errors: [{ messageId: 'eagerPageImport' }],
        filename: 'src/components/AppRouter/ExampleRouter.tsx',
      },
      {
        code: "import { type PageProps, ExamplePage } from '../../pages/ExamplePage';",
        errors: [{ messageId: 'eagerPageImport' }],
        filename: 'src/components/AppRouter/ExampleRouter.tsx',
      },
    ],
  }
);

ruleTester.run(
  'require-suspense-fallback',
  performancePlugin.rules['require-suspense-fallback'],
  {
    valid: [
      {
        code: `
          import { lazy } from 'react';
          import withSuspenseFallback from './withSuspenseFallback';
          const Page = withSuspenseFallback(lazy(() => import('./Page')));
        `,
      },
      {
        code: `
          import { lazy as loadLazy } from 'react';
          import { withPageSuspenseFallback as wrapPage } from './withSuspenseFallback';
          const Page = wrapPage(loadLazy(() => import('./Page')));
        `,
      },
      {
        code: `
          import * as React from 'react';
          import { withPageSuspenseFallback } from '../../components/AppRouter/withSuspenseFallback';
          const Page = withPageSuspenseFallback(React.lazy(() => import('./Page')));
        `,
      },
      {
        code: `
          import React from 'react';
          import { withPageSuspenseFallback } from '../withSuspenseFallback';
          const Page = withPageSuspenseFallback(React.lazy(() => import('./Page')));
        `,
      },
      {
        code: `
          import { lazy, Suspense } from 'react';
          const Page = lazy(() => import('./Page'));
          const App = () => <Suspense fallback={<span>Loading</span>}><Page /></Suspense>;
        `,
      },
      {
        code: `
          import React from 'react';
          const Page = React.lazy(() => import('./Page'));
          const App = () => <React.Suspense fallback={null}><Page /></React.Suspense>;
        `,
      },
      {
        code: `
          import { lazy, Suspense } from 'react';
          const InternalPage = lazy(() => import('./Page'));
          const App = () => {
            const TypedPage = InternalPage;
            return <Suspense fallback={null}><TypedPage /></Suspense>;
          };
        `,
      },
      {
        code: `
          import { lazy, Suspense } from 'react';
          const pageMap = { example: lazy(() => import('./Page')) };
          const App = () => {
            const Page = pageMap.example;
            return <Suspense fallback={null}><Page /></Suspense>;
          };
        `,
      },
      {
        code: `
          import { lazy, Suspense, useMemo } from 'react';
          const Field = lazy(() => import('./Field'));
          const App = () => {
            const fields = useMemo(() => ({ Field }), []);
            return <Suspense fallback={null}><Form fields={fields} /></Suspense>;
          };
        `,
      },
      {
        code: `
          import { lazy } from 'react';
          import withSuspenseFallback from './withSuspenseFallback';
          const PageLazy = lazy(() => import('./Page'));
          const Page = withSuspenseFallback(PageLazy);
        `,
      },
      {
        code: `
          const lazy = (loader) => loader();
          const value = lazy(() => import('./data'));
        `,
      },
    ],
    invalid: [
      {
        code: `
          import { lazy } from 'react';
          const Page = lazy(() => import('./Page'));
        `,
        errors: [{ messageId: 'missingSuspenseFallback' }],
      },
      {
        code: `
          import React from 'react';
          const Page = React.lazy(() => import('./Page'));
        `,
        errors: [{ messageId: 'missingSuspenseFallback' }],
      },
      {
        code: `
          import { lazy } from 'react';
          const withSuspenseFallback = (component) => component;
          const Page = withSuspenseFallback(lazy(() => import('./Page')));
        `,
        errors: [{ messageId: 'missingSuspenseFallback' }],
      },
      {
        code: `
          import { lazy } from 'react';
          import { withSuspenseFallback } from './unrelated';
          const Page = withSuspenseFallback(lazy(() => import('./Page')));
        `,
        errors: [{ messageId: 'missingSuspenseFallback' }],
      },
      {
        code: `
          import { lazy, memo } from 'react';
          import withSuspenseFallback from './withSuspenseFallback';
          const Page = withSuspenseFallback(memo(lazy(() => import('./Page'))));
        `,
        errors: [{ messageId: 'missingSuspenseFallback' }],
      },
      {
        code: `
          import { lazy, Suspense } from 'react';
          const Page = lazy(() => import('./Page'));
          const App = () => <Suspense><Page /></Suspense>;
        `,
        errors: [{ messageId: 'missingSuspenseFallback' }],
      },
      {
        code: `
          import { lazy, Suspense } from 'react';
          const ProtectedPage = lazy(() => import('./ProtectedPage'));
          const UnprotectedPage = lazy(() => import('./UnprotectedPage'));
          const App = () => (
            <>
              <Suspense fallback={null}><ProtectedPage /></Suspense>
              <UnprotectedPage />
            </>
          );
        `,
        errors: [{ messageId: 'missingSuspenseFallback' }],
      },
      {
        code: `
          import { lazy, Suspense } from 'react';
          const Page = lazy(() => import('./Page'));
          const App = () => {
            const Page = () => null;
            return <Suspense fallback={null}><Page /></Suspense>;
          };
        `,
        errors: [{ messageId: 'missingSuspenseFallback' }],
      },
      {
        code: `
          import { lazy } from 'react';
          const Suspense = ({ children }) => children;
          const Page = lazy(() => import('./Page'));
          const App = () => <Suspense fallback={null}><Page /></Suspense>;
        `,
        errors: [{ messageId: 'missingSuspenseFallback' }],
      },
    ],
  }
);

ruleTester.run(
  'no-unbounded-module-cache',
  performancePlugin.rules['no-unbounded-module-cache'],
  {
    valid: [
      {
        code: `
          const MAX_ENTRIES = 200;
          const etagCache = new Map();
          function touch(key, value) {
            etagCache.set(key, value);
            if (etagCache.size > MAX_ENTRIES) {
              etagCache.delete(etagCache.keys().next().value);
            }
          }
        `,
      },
      {
        code: `
          const memoCache = new Set();
          function remember(value) {
            if (memoCache.size >= 100) {
              memoCache.clear();
            }
            memoCache.add(value);
          }
        `,
      },
      {
        code: `
          const MAX_ENTRIES = 200;
          const resultCache = new Map();
          while (resultCache.size > MAX_ENTRIES) {
            resultCache.delete(resultCache.keys().next().value);
          }
        `,
      },
      {
        code: "const ENTITY_TYPES = new Set(['table', 'topic']);",
      },
      {
        code: `
          function buildLookup(values) {
            const resultCache = new Map();
            return values.map((value) => resultCache.get(value));
          }
        `,
      },
      {
        code: `
          function Component() {
            const [tablesCache] = useState(new Map());
            return tablesCache.size;
          }
        `,
      },
    ],
    invalid: [
      {
        code: 'const resultCache = new Map();',
        errors: [{ messageId: 'unboundedModuleCache' }],
      },
      {
        code: `
          const MAX_ENTRIES = 100;
          const resultCache = new Map();
          if (resultCache.size > MAX_ENTRIES) {
            logOverflow();
          }
        `,
        errors: [{ messageId: 'unboundedModuleCache' }],
      },
      {
        code: `
          const MAX_ENTRIES = 100;
          const resultCache = new Map();
          if (resultCache.size > MAX_ENTRIES) {
            logOverflow();
          }
          function invalidate(key) {
            resultCache.delete(key);
          }
        `,
        errors: [{ messageId: 'unboundedModuleCache' }],
      },
      {
        code: `
          const MAX_ENTRIES = 100;
          const resultCache = new Map();
          function createLocalCache() {
            const resultCache = new Map();
            if (resultCache.size > MAX_ENTRIES) {
              resultCache.clear();
            }
            return resultCache;
          }
        `,
        errors: [{ messageId: 'unboundedModuleCache' }],
      },
      {
        code: `
          const resultCache = new Map();
          resultCache.delete('oldest');
        `,
        errors: [{ messageId: 'unboundedModuleCache' }],
      },
      {
        code: `
          const maxEntries = 100;
          const resultCache = new Map();
          if (resultCache.size > maxEntries) {
            resultCache.clear();
          }
        `,
        errors: [{ messageId: 'unboundedModuleCache' }],
      },
      {
        code: 'const memoizedValues = new Set();',
        errors: [{ messageId: 'unboundedModuleCache' }],
      },
    ],
  }
);
