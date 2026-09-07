'use strict';
const { defineInlineTest, runInlineTest } = require('jscodeshift/dist/testUtils');
const transform = require('../transforms/move-named-imports');

const OPTS = { names: 'Divider,Tag', from: 'antd', to: '@openmetadata/ui-core-components' };

defineInlineTest(
  transform,
  OPTS,
  `import { Button, Divider } from 'antd';`,
  `import { Button } from 'antd';\nimport { Divider } from '@openmetadata/ui-core-components';`,
  'moves a listed specifier, keeps the rest on antd'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Divider, Tag } from 'antd';`,
  `import { Divider, Tag } from '@openmetadata/ui-core-components';`,
  'removes the antd import entirely when all specifiers move'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Divider as Sep } from 'antd';`,
  `import { Divider as Sep } from '@openmetadata/ui-core-components';`,
  'preserves aliases'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Card } from '@openmetadata/ui-core-components';\nimport { Divider } from 'antd';`,
  `import { Card, Divider } from '@openmetadata/ui-core-components';`,
  'merges into an existing target import'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';`,
  `import { Button } from 'antd';`,
  'no-op when no listed specifier is present'
);

defineInlineTest(
  transform,
  OPTS,
  `/*\n * License header\n */\nimport { Divider } from 'antd';\nexport const x = 1;`,
  `/*\n * License header\n */\nimport { Divider } from '@openmetadata/ui-core-components';\nexport const x = 1;`,
  'keeps the license header attached to the top of file'
);

defineInlineTest(
  transform,
  OPTS,
  `/*\n * License header\n */\nimport { Divider } from 'antd';\nimport { Card } from '@openmetadata/ui-core-components';`,
  `/*\n * License header\n */\nimport { Card, Divider } from '@openmetadata/ui-core-components';`,
  'keeps the license header at the top when a full move merges into an existing target import'
);

defineInlineTest(
  transform,
  OPTS,
  `import Something from './something';\n// eslint-disable-next-line no-restricted-imports\nimport { Divider } from 'antd';\nimport { Card } from '@openmetadata/ui-core-components';`,
  `import Something from './something';\nimport { Card, Divider } from '@openmetadata/ui-core-components';`,
  'does not re-home comments from a non-first antd import onto an unrelated statement'
);

const TYPE_OPTS = {
  names: 'TabsProps',
  from: 'antd',
  to: '@openmetadata/ui-core-components',
};

defineInlineTest(
  transform,
  TYPE_OPTS,
  `import type { TabsProps } from 'antd';`,
  `import type { TabsProps } from '@openmetadata/ui-core-components';`,
  'preserves importKind: type when the source declaration is a type-only import'
);

defineInlineTest(
  transform,
  TYPE_OPTS,
  `import type { TabsProps } from 'antd';\nimport { Card } from '@openmetadata/ui-core-components';`,
  `import type { TabsProps } from '@openmetadata/ui-core-components';\nimport { Card } from '@openmetadata/ui-core-components';`,
  'does not merge a type-only specifier into an existing value import of the same target module'
);

// ── --toPath: destination is a file in the repo, not a package ──────────────
// The specifier has to be recomputed per file: relative depth differs between
// call sites and there is no `src` resolve root to fall back on. These use
// runInlineTest rather than defineInlineTest because only the former lets a
// test supply the file path the specifier is resolved from.

const TO_PATH_OPTS = {
  names: 'ColumnsType,ColumnType',
  from: 'antd/lib/table',
  toPath: 'src/components/common/Table/Table.interface.ts',
};

const defineToPathTest = (name, path, source, expectedOutput) =>
  it(name, () => {
    runInlineTest(transform, TO_PATH_OPTS, { path, source }, expectedOutput);
  });

defineToPathTest(
  'writes a sibling specifier as ./',
  'src/components/common/Table/SomeTable.tsx',
  `import { ColumnsType } from 'antd/lib/table';`,
  `import { ColumnsType } from './Table.interface';`
);

defineToPathTest(
  'climbs out of nested directories',
  'src/pages/Deeply/Nested/Page.tsx',
  `import { ColumnsType } from 'antd/lib/table';`,
  `import { ColumnsType } from '../../../components/common/Table/Table.interface';`
);

defineToPathTest(
  'leaves the destination module itself untouched',
  'src/components/common/Table/Table.interface.ts',
  `import { ColumnsType } from 'antd/lib/table';`,
  `import { ColumnsType } from 'antd/lib/table';`
);

defineToPathTest(
  'keeps a default import behind when its named sibling moves',
  'src/components/common/Table/SomeTable.tsx',
  `import Table, { ColumnsType } from 'antd/lib/table';`,
  `import Table from 'antd/lib/table';\nimport { ColumnsType } from './Table.interface';`
);

defineToPathTest(
  'keeps a type-only import type-only',
  'src/components/common/Table/SomeTable.tsx',
  `import type { ColumnsType } from 'antd/lib/table';`,
  `import type { ColumnsType } from './Table.interface';`
);

// Regression: when every specifier of a type-only import moves into a target
// that already has a type-only import, the declaration is removed. The second
// pass of the kind loop used to re-filter a stale collection, whose paths then
// resolved to the next statement — `path.node.specifiers is not iterable`.
defineToPathTest(
  'survives a full type-only move into an existing type-only target',
  'src/components/common/Table/TableV2Utils.ts',
  `import type { ColumnsType } from 'antd/lib/table';\nimport type { ColumnType } from './Table.interface';\n\nexport function noop() {}`,
  `import type { ColumnType, ColumnsType } from './Table.interface';\n\nexport function noop() {}`
);
