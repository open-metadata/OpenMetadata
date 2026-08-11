'use strict';
const { defineInlineTest } = require('jscodeshift/dist/testUtils');
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
