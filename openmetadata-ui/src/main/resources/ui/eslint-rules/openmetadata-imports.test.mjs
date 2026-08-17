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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, describe, it } from 'node:test';
import { ESLint, RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';

RuleTester.describe = describe;
RuleTester.it = it;

const EXPECTED_RULES = [
  'no-api-calls-in-iteration',
  'no-circular-imports',
  'no-cross-page-imports',
  'no-hook-ui-imports',
  'no-impure-pure-utils',
  'no-internal-barrel-imports',
  'no-lodash-default-import',
  'no-lower-layer-page-imports',
  'no-rest-ui-imports',
  'review-sequential-api-calls',
];

test('exports every warning-tier import rule', async () => {
  let importPlugin;

  try {
    importPlugin = (await import('./openmetadata-imports.mjs')).default;
  } catch {
    importPlugin = undefined;
  }

  assert.deepEqual(
    Object.keys(importPlugin?.rules ?? {}).sort(),
    EXPECTED_RULES
  );
});

test('configures every import rule as a warning', async () => {
  const eslint = new ESLint();
  const config = await eslint.calculateConfigForFile('src/App.tsx');

  for (const rule of EXPECTED_RULES) {
    assert.equal(config.rules[`openmetadata-imports/${rule}`]?.[0], 1, rule);
  }
});

const importPlugin = (await import('./openmetadata-imports.mjs')).default;
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

const refreshRoot = mkdtempSync(join(tmpdir(), 'openmetadata-eslint-refresh-'));
const refreshSrc = join(refreshRoot, 'src');
mkdirSync(refreshSrc, { recursive: true });
const refreshA = join(refreshSrc, 'a.ts');
const refreshB = join(refreshSrc, 'b.ts');
const refreshACode = "import { b } from './b'; export const a = b;";
writeFileSync(refreshA, `${refreshACode}\n`);
writeFileSync(refreshB, 'export const b = 1;\n');

test('refreshes circular imports after a dependency changes', async () => {
  const eslint = new ESLint({
    cwd: refreshRoot,
    overrideConfig: {
      files: ['**/*.ts'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { sourceType: 'module' },
      },
      plugins: { 'openmetadata-imports': importPlugin },
      rules: { 'openmetadata-imports/no-circular-imports': 'warn' },
    },
    overrideConfigFile: true,
  });
  const [initial] = await eslint.lintText(refreshACode, { filePath: refreshA });

  assert.deepEqual(initial.messages, []);

  writeFileSync(refreshB, "import { a } from './a'; export const b = a;\n");

  const [updated] = await eslint.lintText(refreshACode, { filePath: refreshA });

  assert.equal(updated.messages.length, 1);
});

ruleTester.run(
  'no-impure-pure-utils',
  importPlugin.rules['no-impure-pure-utils'],
  {
    valid: [
      {
        code: "import type { Entity } from '../interface/entity.interface';",
        filename: '/project/src/utils/EntityPureUtils.ts',
      },
      {
        code: "import Component from '../components/Component';",
        filename: '/project/src/utils/EntityRenderUtils.tsx',
      },
    ],
    invalid: [
      {
        code: "import type { Props } from '../components/Component.interface';",
        errors: 1,
        filename: '/project/src/utils/EntityPureUtils.ts',
      },
      {
        code: "import { getEntity } from '../rest/entityAPI';",
        errors: 1,
        filename: '/project/src/utils/EntityPureUtils.ts',
      },
      {
        code: 'const value = <span>value</span>;',
        errors: 1,
        filename: '/project/src/utils/EntityPureUtils.tsx',
      },
    ],
  }
);

ruleTester.run(
  'no-lower-layer-page-imports',
  importPlugin.rules['no-lower-layer-page-imports'],
  {
    valid: [
      {
        code: "import Page from '../pages/ExamplePage';",
        filename: '/project/src/components/AppRouter/ExampleRouter.tsx',
      },
      {
        code: "import Widget from '../../components/Widget';",
        filename: '/project/src/pages/ExamplePage/ExamplePage.tsx',
      },
    ],
    invalid: [
      {
        code: "import Page from '../pages/ExamplePage';",
        errors: 1,
        filename: '/project/src/components/Widget.tsx',
      },
      {
        code: "import type { PageProps } from '../pages/ExamplePage.interface';",
        errors: 1,
        filename: '/project/src/utils/ExampleUtils.ts',
      },
    ],
  }
);

ruleTester.run(
  'no-cross-page-imports',
  importPlugin.rules['no-cross-page-imports'],
  {
    valid: [
      {
        code: "import Widget from './components/Widget';",
        filename: '/project/src/pages/ExamplePage/ExamplePage.tsx',
      },
    ],
    invalid: [
      {
        code: "import OtherPage from '../OtherPage/OtherPage';",
        errors: 1,
        filename: '/project/src/pages/ExamplePage/ExamplePage.tsx',
      },
    ],
  }
);

ruleTester.run('no-rest-ui-imports', importPlugin.rules['no-rest-ui-imports'], {
  valid: [
    {
      code: "import type { Entity } from '../interface/entity.interface';",
      filename: '/project/src/rest/entityAPI.ts',
    },
  ],
  invalid: [
    {
      code: "import type { Option } from '../components/Select.interface';",
      errors: 1,
      filename: '/project/src/rest/entityAPI.ts',
    },
  ],
});

ruleTester.run('no-hook-ui-imports', importPlugin.rules['no-hook-ui-imports'], {
  valid: [
    {
      code: "import { getEntity } from '../rest/entityAPI';",
      filename: '/project/src/hooks/useEntity.ts',
    },
  ],
  invalid: [
    {
      code: "import Widget from '../components/Widget';",
      errors: 1,
      filename: '/project/src/hooks/useEntity.ts',
    },
  ],
});

const barrelRoot = mkdtempSync(join(tmpdir(), 'openmetadata-eslint-barrel-'));
const barrelSrc = join(barrelRoot, 'src');
mkdirSync(join(barrelSrc, 'components', 'Widget'), { recursive: true });
writeFileSync(
  join(barrelSrc, 'components', 'Widget', 'index.ts'),
  "export { Widget } from './Widget';\n"
);
writeFileSync(
  join(barrelSrc, 'components', 'Widget', 'Widget.ts'),
  'export const Widget = {};\n'
);

ruleTester.run(
  'no-internal-barrel-imports',
  importPlugin.rules['no-internal-barrel-imports'],
  {
    valid: [
      {
        code: "import { Widget } from './components/Widget/Widget';",
        filename: join(barrelSrc, 'App.ts'),
      },
      {
        code: "import type { Widget } from './components/Widget';",
        filename: join(barrelSrc, 'App.ts'),
      },
      {
        code: "export type * from './components/Widget';",
        filename: join(barrelSrc, 'App.ts'),
      },
      {
        code: "import { Button } from '@openmetadata/ui-core-components';",
        filename: join(barrelSrc, 'App.ts'),
      },
    ],
    invalid: [
      {
        code: "import { Widget } from './components/Widget';",
        errors: 1,
        filename: join(barrelSrc, 'App.ts'),
      },
    ],
  }
);

ruleTester.run(
  'no-lodash-default-import',
  importPlugin.rules['no-lodash-default-import'],
  {
    valid: [
      {
        code: "import { isEmpty } from 'lodash';",
      },
      {
        code: "import isEmpty from 'lodash/isEmpty';",
      },
    ],
    invalid: [
      {
        code: "import lodash from 'lodash';",
        errors: 1,
      },
      {
        code: "import * as lodash from 'lodash';",
        errors: 1,
      },
    ],
  }
);

ruleTester.run(
  'no-api-calls-in-iteration',
  importPlugin.rules['no-api-calls-in-iteration'],
  {
    valid: [
      {
        code: `
          import { getEntity } from '../rest/entityAPI';
          const entity = await getEntity(id);
          const names = entities.map((item) => item.name);
        `,
        filename: '/project/src/components/Entity.tsx',
      },
      {
        code: `
          import { getEntity } from '../rest/entityAPI';
          function build(getEntity) {
            return entities.map((item) => getEntity(item.id));
          }
        `,
        filename: '/project/src/components/Entity.tsx',
      },
    ],
    invalid: [
      {
        code: `
          import { getEntity } from '../rest/entityAPI';
          const entities = ids.map((id) => getEntity(id));
        `,
        errors: 1,
        filename: '/project/src/components/Entity.tsx',
      },
      {
        code: `
          import * as entityAPI from '../rest/entityAPI';
          for (const id of ids) {
            await entityAPI.getEntity(id);
          }
        `,
        errors: 1,
        filename: '/project/src/components/Entity.tsx',
      },
    ],
  }
);

ruleTester.run(
  'review-sequential-api-calls',
  importPlugin.rules['review-sequential-api-calls'],
  {
    valid: [
      {
        code: `
          import { getEntity, getLineage } from '../rest/entityAPI';
          async function load(id) {
            return Promise.all([getEntity(id), getLineage(id)]);
          }
        `,
        filename: '/project/src/components/Entity.tsx',
      },
      {
        code: `
          import { getEntity, getLineage } from '../rest/entityAPI';
          async function load(id, includeLineage) {
            if (includeLineage) {
              return await getLineage(id);
            } else {
              return await getEntity(id);
            }
          }
        `,
        filename: '/project/src/components/Entity.tsx',
      },
      {
        code: `
          import { getEntity, getLineage } from '../rest/entityAPI';
          async function load(id, entityType) {
            switch (entityType) {
              case 'table':
                return await getEntity(id);
              default:
                return await getLineage(id);
            }
          }
        `,
        filename: '/project/src/components/Entity.tsx',
      },
      {
        code: `
          import { getEntity, getLineage } from '../rest/entityAPI';
          async function load(id) {
            try {
              return await getEntity(id);
            } catch {
              return await getLineage(id);
            }
          }
        `,
        filename: '/project/src/components/Entity.tsx',
      },
    ],
    invalid: [
      {
        code: `
          import { getEntity, getLineage } from '../rest/entityAPI';
          async function load(id) {
            const entity = await getEntity(id);
            const lineage = await getLineage(id);
            return { entity, lineage };
          }
        `,
        errors: 1,
        filename: '/project/src/components/Entity.tsx',
      },
      {
        code: `
          import { getEntity, getLineage } from '../rest/entityAPI';
          async function load(id, includeEntity) {
            if (includeEntity) {
              await getEntity(id);
            }
            return await getLineage(id);
          }
        `,
        errors: 1,
        filename: '/project/src/components/Entity.tsx',
      },
    ],
  }
);

const cycleRoot = mkdtempSync(join(tmpdir(), 'openmetadata-eslint-cycle-'));
const cycleSrc = join(cycleRoot, 'src');
mkdirSync(cycleSrc, { recursive: true });
const cycleA = join(cycleSrc, 'a.ts');
const cycleB = join(cycleSrc, 'b.ts');
writeFileSync(cycleA, "import { b } from './b';\nexport const a = b;\n");
writeFileSync(cycleB, "import { a } from './a';\nexport const b = a;\n");

const acyclicRoot = mkdtempSync(join(tmpdir(), 'openmetadata-eslint-acyclic-'));
const acyclicSrc = join(acyclicRoot, 'src');
mkdirSync(acyclicSrc, { recursive: true });
const acyclicA = join(acyclicSrc, 'a.ts');
writeFileSync(acyclicA, "import { b } from './b';\nexport const a = b;\n");
writeFileSync(join(acyclicSrc, 'b.ts'), 'export const b = 1;\n');

after(() => {
  rmSync(barrelRoot, { force: true, recursive: true });
  rmSync(cycleRoot, { force: true, recursive: true });
  rmSync(acyclicRoot, { force: true, recursive: true });
  rmSync(refreshRoot, { force: true, recursive: true });
});

ruleTester.run(
  'no-circular-imports',
  importPlugin.rules['no-circular-imports'],
  {
    valid: [
      {
        code: "import { b } from './b'; export const a = b;",
        filename: acyclicA,
      },
      {
        code: "import type { B } from './b'; export type A = B;",
        filename: cycleA,
      },
    ],
    invalid: [
      {
        code: "import { b } from './b'; export const a = b;",
        errors: 1,
        filename: cycleA,
      },
    ],
  }
);
