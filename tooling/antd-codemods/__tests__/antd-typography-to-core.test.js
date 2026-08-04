'use strict';
const { defineInlineTest } = require('jscodeshift/dist/testUtils');
const transform = require('../transforms/antd-typography-to-core');

const OPTS = {};

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Text data-testid="foo">Hi</Typography.Text>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography data-testid="foo">Hi</Typography>;`,
  'Text basic: converts to bare Typography (span default, no as)'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Paragraph>Hi</Typography.Paragraph>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography as='p'>Hi</Typography>;`,
  'Paragraph: converts with as="p"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Link href="/x">Go</Typography.Link>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography as='a' href="/x">Go</Typography>;`,
  'Link: converts with as="a" and keeps href'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Title level={5}>Hi</Typography.Title>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography as='h5' size='text-md'>Hi</Typography>;`,
  'Title level=5: maps to h5/text-md (the dominant real-world case)'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Title level={1}>Hi</Typography.Title>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography as='h1' size='display-sm'>Hi</Typography>;`,
  'Title level=1: maps to h1/display-sm'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Title>Hi</Typography.Title>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography as='h1' size='display-sm'>Hi</Typography>;`,
  'Title with no level attribute: antd default level 1'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = ({ level }) => <Typography.Title level={level}>Hi</Typography.Title>;`,
  `import { Typography } from 'antd';\nconst App = ({ level }) => <Typography.Title level={level}>Hi</Typography.Title>;`,
  'Title with dynamic level={expr}: left untouched, reported as needs-hand-finish'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst { Text, Title } = Typography;\nconst App = () => (\n  <>\n    <Text>Hi</Text>\n    <Title level={3}>Yo</Title>\n  </>\n);`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => (\n  <>\n    <Typography>Hi</Typography>\n    <Typography as='h3' size='text-xl'>Yo</Typography>\n  </>\n);`,
  'destructured Text/Title: rewrites bare JSX and removes the destructuring declaration'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst { Text: T } = Typography;\nconst App = () => <T>Hi</T>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography>Hi</Typography>;`,
  'destructured alias (Text: T): rewrites <T> using the aliased local name'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Text type="secondary">Hi</Typography.Text>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography color='secondary'>Hi</Typography>;`,
  'type="secondary" becomes color="secondary"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Text type="danger">Hi</Typography.Text>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography color='danger'>Hi</Typography>;`,
  'type="danger" becomes color="danger"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Text strong>Hi</Typography.Text>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography weight='bold'>Hi</Typography>;`,
  '`strong` becomes weight="bold"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Text underline className="tw:text-md">Hi</Typography.Text>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography className='tw:text-md tw:underline'>Hi</Typography>;`,
  '`underline` merges tw:underline into an existing className'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Text underline>Hi</Typography.Text>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography className='tw:underline'>Hi</Typography>;`,
  '`underline` creates a className when absent'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Text underline className={dynamicClass}>Hi</Typography.Text>;`,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Text underline className={dynamicClass}>Hi</Typography.Text>;`,
  '`underline` with a non-literal className: left untouched, reported'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Text ellipsis={{ rows: 2, tooltip: true }}>Hi</Typography.Text>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography ellipsis={{ rows: 2, tooltip: true }}>Hi</Typography>;`,
  'ellipsis={{ rows, tooltip }} passes through unchanged'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography.Text ellipsis>Hi</Typography.Text>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography ellipsis>Hi</Typography>;`,
  'ellipsis boolean passes through unchanged'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => (\n  <>\n    <Typography.Text copyable>Hi</Typography.Text>\n    <Typography.Paragraph>Yo</Typography.Paragraph>\n  </>\n);`,
  `import { Typography } from 'antd';\nimport { Typography as CoreTypography } from '@openmetadata/ui-core-components';\nconst App = () => (\n  <>\n    <Typography.Text copyable>Hi</Typography.Text>\n    <CoreTypography as='p'>Yo</CoreTypography>\n  </>\n);`,
  '`copyable`: unsupported prop skips its element; file partially converts using the CoreTypography alias'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from "antd";\nconst App = () => <Typography.Text>Hi</Typography.Text>;`,
  `import { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography>Hi</Typography>;`,
  'double-quoted antd import is matched the same as single-quoted'
);

defineInlineTest(
  transform,
  OPTS,
  `/*\n * License header\n */\nimport { Typography } from 'antd';\nconst App = () => <Typography.Text>Hi</Typography.Text>;`,
  `/*\n * License header\n */\nimport { Typography } from '@openmetadata/ui-core-components';\nconst App = () => <Typography>Hi</Typography>;`,
  'preserves a license header comment when the antd import is fully removed'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography, Button } from 'antd';\nconst App = () => (\n  <>\n    <Button>Click</Button>\n    <Typography.Text>Hi</Typography.Text>\n  </>\n);`,
  `import { Button } from 'antd';\nimport { Typography } from '@openmetadata/ui-core-components';\nconst App = () => (\n  <>\n    <Button>Click</Button>\n    <Typography>Hi</Typography>\n  </>\n);`,
  'multi-component antd import keeps sibling specifiers (Button) on antd'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Card } from '@openmetadata/ui-core-components';\nimport { Typography } from 'antd';\nconst App = () => (\n  <>\n    <Card />\n    <Typography.Text>Hi</Typography.Text>\n  </>\n);`,
  `import { Card, Typography } from '@openmetadata/ui-core-components';\nconst App = () => (\n  <>\n    <Card />\n    <Typography>Hi</Typography>\n  </>\n);`,
  'merges into an existing core import when fully converted'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Typography } from 'antd';\nconst App = () => <Typography>Hi</Typography>;`,
  `import { Typography } from 'antd';\nconst App = () => <Typography>Hi</Typography>;`,
  'bare <Typography> stays untouched (no-op, import unchanged)'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button>Click</Button>;`,
  `import { Button } from 'antd';\nconst App = () => <Button>Click</Button>;`,
  'no-op when the file does not import Typography from antd at all'
);

describe('console.warn reporting', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns with the file path and skip reason for a dynamic Title level', () => {
    transform(
      {
        path: 'src/components/Foo.tsx',
        source: `import { Typography } from 'antd';\nconst App = ({ level }) => <Typography.Title level={level}>Hi</Typography.Title>;`,
      },
      { jscodeshift: require('jscodeshift').withParser('tsx') }
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(message).toContain('src/components/Foo.tsx');
    expect(message).toContain('dynamic-title-level');
  });

  it('warns for an unsupported prop (copyable)', () => {
    transform(
      {
        path: 'src/components/Bar.tsx',
        source: `import { Typography } from 'antd';\nconst App = () => <Typography.Text copyable>Hi</Typography.Text>;`,
      },
      { jscodeshift: require('jscodeshift').withParser('tsx') }
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(message).toContain('unsupported-prop');
  });

  it('does not warn when everything converts cleanly', () => {
    transform(
      {
        path: 'src/components/Baz.tsx',
        source: `import { Typography } from 'antd';\nconst App = () => <Typography.Text>Hi</Typography.Text>;`,
      },
      { jscodeshift: require('jscodeshift').withParser('tsx') }
    );

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
