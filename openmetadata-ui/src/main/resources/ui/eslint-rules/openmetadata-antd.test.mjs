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
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { describe, it } from 'node:test';
import { ESLint, RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import antdPlugin from './openmetadata-antd.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const MIGRATED = [{ components: ['Tooltip', 'Space'] }];
const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run('no-antd-import', antdPlugin.rules['no-antd-import'], {
  valid: [
    {
      code: "import { Button } from '@openmetadata/ui-core-components';",
      options: MIGRATED,
    },
    // Migrated components belong to no-migrated-antd-import, so they never
    // enter the suppression baseline.
    { code: "import { Tooltip } from 'antd';", options: MIGRATED },
    {
      code: "import type { TooltipPlacement } from 'antd/lib/tooltip';",
      options: MIGRATED,
    },
  ],
  invalid: [
    {
      // One report per symbol, so adding a symbol to an existing import
      // exceeds a file's suppressed count.
      code: "import { Button, Card, Tooltip } from 'antd';",
      options: MIGRATED,
      errors: [{ messageId: 'antdImport' }, { messageId: 'antdImport' }],
    },
    {
      code: "import type { FormProps } from 'antd/lib/form';",
      errors: [{ messageId: 'antdImport' }],
    },
    {
      code: "import { PlusOutlined } from '@ant-design/icons';",
      errors: [{ messageId: 'antdImport' }],
    },
    {
      code: "import Icon from '@ant-design/icons/lib/components/Icon';",
      errors: [{ messageId: 'antdImport' }],
    },
    {
      code: "export { Button } from 'antd';",
      errors: [{ messageId: 'antdImport' }],
    },
    {
      code: "export * from 'antd';",
      errors: [{ messageId: 'antdImport' }],
    },
    {
      code: "import 'antd/dist/antd.css';",
      errors: [{ messageId: 'antdImport' }],
    },
    {
      code: "const antd = await import('antd');",
      errors: [{ messageId: 'antdImport' }],
    },
    {
      code: "const { Button } = require('antd');",
      errors: [{ messageId: 'antdImport' }],
    },
    {
      code: "type Props = import('antd').ButtonProps;",
      errors: [{ messageId: 'antdImport' }],
    },
  ],
});

ruleTester.run(
  'no-migrated-antd-import',
  antdPlugin.rules['no-migrated-antd-import'],
  {
    valid: [
      { code: "import { Button } from 'antd';", options: MIGRATED },
      {
        code: "import { Tooltip } from '@openmetadata/ui-core-components';",
        options: MIGRATED,
      },
    ],
    invalid: [
      {
        code: "import { Button, Tooltip as AntdTooltip } from 'antd';",
        options: MIGRATED,
        errors: [{ messageId: 'migratedImport', data: { component: 'Tooltip' } }],
      },
      {
        code: "import type { TooltipProps } from 'antd';",
        options: MIGRATED,
        errors: [{ messageId: 'migratedImport' }],
      },
      {
        code: "import type { TooltipPlacement } from 'antd/lib/tooltip';",
        options: MIGRATED,
        errors: [{ messageId: 'migratedImport' }],
      },
      {
        code: "import { Space } from 'antd';",
        options: MIGRATED,
        errors: [{ messageId: 'migratedImport', data: { component: 'Space' } }],
      },
    ],
  }
);

// The ratchet only holds if the real config wires both rules to the same
// migrated list and the suppression file covers just the general rule.
test('the app config never suppresses a migrated component', async () => {
  const eslint = new ESLint({
    cwd: process.cwd(),
    overrideConfigFile: join(process.cwd(), 'eslint.config.mjs'),
  });
  const config = await eslint.calculateConfigForFile(
    'src/components/common/Example.tsx'
  );
  const general = config.rules['openmetadata-antd/no-antd-import'];
  const migrated = config.rules['openmetadata-antd/no-migrated-antd-import'];

  assert.equal(general[0], 2);
  assert.equal(migrated[0], 2);
  assert.deepEqual(general[1], migrated[1]);

  const { default: suppressions } = await import('../eslint-suppressions.json', {
    with: { type: 'json' },
  });
  const suppressedMigratedRules = Object.values(suppressions).filter(
    (rules) => rules['openmetadata-antd/no-migrated-antd-import']
  );

  assert.equal(suppressedMigratedRules.length, 0);

  // Exact, so re-running --suppress-rule cannot quietly absorb new antd usage.
  // Lower this when a PR removes antd imports and prunes the baseline.
  const EXPECTED_SUPPRESSED_ANTD_SYMBOLS = 819;
  const suppressedSymbols = Object.values(suppressions).reduce(
    (total, rules) =>
      total + (rules['openmetadata-antd/no-antd-import']?.count ?? 0),
    0
  );

  assert.equal(suppressedSymbols, EXPECTED_SUPPRESSED_ANTD_SYMBOLS);
});

// Runs the real CLI because bulk suppressions are applied only there.
test('suppressed counts can only go down', () => {
  const dir = mkdtempSync(join(tmpdir(), 'om-antd-'));
  const eslintBin = fileURLToPath(
    new URL('../node_modules/eslint/bin/eslint.js', import.meta.url)
  );
  const lint = (source, count) => {
    writeFileSync(join(dir, 'file.js'), source);
    writeFileSync(
      join(dir, 'eslint-suppressions.json'),
      JSON.stringify({ 'file.js': { 'a/no-antd-import': { count } } })
    );

    return spawnSync(process.execPath, [eslintBin, 'file.js'], {
      cwd: dir,
      encoding: 'utf8',
    }).status;
  };

  try {
    writeFileSync(
      join(dir, 'eslint.config.mjs'),
      `import plugin from ${JSON.stringify(
        new URL('./openmetadata-antd.mjs', import.meta.url).href
      )};
export default [{ plugins: { a: plugin }, rules: { 'a/no-antd-import': 'error' } }];`
    );
    const twoSymbols = "import { Button, Card } from 'antd';\n";

    assert.equal(lint(twoSymbols, 2), 0, 'the frozen backlog passes');
    assert.equal(lint(twoSymbols, 1), 1, 'a new symbol fails');
    assert.equal(lint(twoSymbols, 3), 2, 'a stale suppression must be pruned');
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});
