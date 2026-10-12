'use strict';
const { defineInlineTest } = require('jscodeshift/dist/testUtils');
const transform = require('../transforms/antd-button-to-core');

const OPTS = {};

// -- `type` literal mapping (incl. no-type -> secondary default) --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button type="primary">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='primary'>Click</Button>;`,
  'type="primary" becomes color="primary"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button type="default">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='secondary'>Click</Button>;`,
  'type="default" becomes color="secondary"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button type="text">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='tertiary'>Click</Button>;`,
  'type="text" becomes color="tertiary"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button type="link">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='link-gray'>Click</Button>;`,
  'type="link" becomes color="link-gray"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button onClick={fn}>Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button onClick={fn} color='secondary'>Click</Button>;`,
  'no `type` prop: antd default type is "default" -> explicit color="secondary" (core default is "primary")'
);

// -- `danger` fold-in, per base type, plus bare danger --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button danger type="primary">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='primary-destructive'>Click</Button>;`,
  'danger + type="primary" -> color="primary-destructive"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button danger type="default">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='secondary-destructive'>Click</Button>;`,
  'danger + type="default" -> color="secondary-destructive"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button danger type="text">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='tertiary-destructive'>Click</Button>;`,
  'danger + type="text" -> color="tertiary-destructive"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button danger type="link">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='link-destructive'>Click</Button>;`,
  'danger + type="link" -> color="link-destructive"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button danger onClick={fn}>Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button onClick={fn} color='secondary-destructive'>Click</Button>;`,
  'bare `danger` (no type): antd default type is "default" -> color="secondary-destructive"'
);

// -- `ghost` boolean and `type="ghost"` literal --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button ghost onClick={fn}>Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button onClick={fn} color='tertiary'>Click</Button>;`,
  '`ghost` boolean modifier -> color="tertiary" (approved 2026-07-30), reported via ghost-remap warn'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button type="ghost">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='tertiary'>Click</Button>;`,
  'type="ghost" literal -> color="tertiary" (same mapping as boolean ghost)'
);

// -- `size` literal mapping + dynamic-size skip --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button size="small">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='secondary' size='xs'>Click</Button>;`,
  'size="small" -> size="xs"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button size="middle">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='secondary' size='sm'>Click</Button>;`,
  'size="middle" -> size="sm"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button size="large">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='secondary' size='md'>Click</Button>;`,
  'size="large" -> size="md"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = ({ sz }) => <Button size={sz}>Click</Button>;`,
  `import { Button } from 'antd';\nconst App = ({ sz }) => <Button size={sz}>Click</Button>;`,
  'size={dynamicExpr}: left untouched, reported as needs-hand-finish (dynamic-size)'
);

// -- `disabled` / `loading` renames, both bare and ={expr} forms --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button disabled>Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='secondary' isDisabled>Click</Button>;`,
  'bare `disabled` -> bare `isDisabled`'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button disabled={isBlocked}>Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='secondary' isDisabled={isBlocked}>Click</Button>;`,
  '`disabled={expr}` -> `isDisabled={expr}`'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button loading>Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='secondary' isLoading>Click</Button>;`,
  'bare `loading` -> bare `isLoading`'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button loading={isSaving}>Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='secondary' isLoading={isSaving}>Click</Button>;`,
  '`loading={expr}` -> `isLoading={expr}`'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button loading={{ delay: 200 }}>Click</Button>;`,
  `import { Button } from 'antd';\nconst App = () => <Button loading={{ delay: 200 }}>Click</Button>;`,
  '`loading={{ delay }}` object form: left untouched, reported (loading-object)'
);

// -- `htmlType` + `type` on the same element (ordering) --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button htmlType="submit" type="primary">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='primary' type='submit'>Click</Button>;`,
  '`htmlType` + `type` on the same element: never collide, both rewritten correctly'
);

// -- `icon` rename --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button icon={<PlusOutlined />}>Add</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='secondary' iconLeading={<PlusOutlined />}>Add</Button>;`,
  '`icon={...}` -> `iconLeading={...}` (any value form)'
);

// -- `block` into existing/absent className + dynamic-className skip --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button block>Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='secondary' className='tw:w-full'>Click</Button>;`,
  '`block` with no className: creates className="tw:w-full"'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button block className="existing-class">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='secondary' className='existing-class tw:w-full'>Click</Button>;`,
  '`block` with an existing literal className: merges tw:w-full'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button block className={dynamicClass}>Click</Button>;`,
  `import { Button } from 'antd';\nconst App = () => <Button block className={dynamicClass}>Click</Button>;`,
  '`block` with a non-literal className: left untouched, reported (dynamic-classname)'
);

// -- `shape` skips --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button shape="circle">X</Button>;`,
  `import { Button } from 'antd';\nconst App = () => <Button shape="circle">X</Button>;`,
  'shape="circle": left untouched, reported (shape-unsupported)'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button shape="round">X</Button>;`,
  `import { Button } from 'antd';\nconst App = () => <Button shape="round">X</Button>;`,
  'shape="round": left untouched, reported (shape-unsupported)'
);

// -- `Button.Group` skip --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button.Group>Hi</Button.Group>;`,
  `import { Button } from 'antd';\nconst App = () => <Button.Group>Hi</Button.Group>;`,
  '`Button.Group`: left untouched entirely, reported (button-group)'
);

// -- `ButtonGroup`-from-subpath skip --

defineInlineTest(
  transform,
  OPTS,
  `import ButtonGroup from 'antd/lib/button/button-group';\nconst App = () => <ButtonGroup>Hi</ButtonGroup>;`,
  `import ButtonGroup from 'antd/lib/button/button-group';\nconst App = () => <ButtonGroup>Hi</ButtonGroup>;`,
  '`ButtonGroup` from the antd subpath import: left untouched, reported (button-group-subpath), import untouched'
);

// -- `ref` preserved (forwardRef landed, no skip) --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => <Button ref={btnRef} type="primary">Click</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button ref={btnRef} color='primary'>Click</Button>;`,
  '`ref={...}` is kept as-is (Button is forwardRef-wrapped) and the element still converts'
);

// -- Partial conversion: CoreButton alias, both imports kept --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from 'antd';\nconst App = () => (\n  <>\n    <Button type="primary">Ok</Button>\n    <Button shape="circle">X</Button>\n  </>\n);`,
  `import { Button } from 'antd';\nimport { Button as CoreButton } from '@openmetadata/ui-core-components';\nconst App = () => (\n  <>\n    <CoreButton color='primary'>Ok</CoreButton>\n    <Button shape="circle">X</Button>\n  </>\n);`,
  'partial conversion: one skip forces the CoreButton alias, antd Button import stays for the skipped element'
);

// -- Full conversion: import swap + license header preserved --

defineInlineTest(
  transform,
  OPTS,
  `/*\n * License header\n */\nimport { Button } from 'antd';\nconst App = () => <Button type="primary">Ok</Button>;`,
  `/*\n * License header\n */\nimport { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='primary'>Ok</Button>;`,
  'preserves a license header comment when the antd import is fully removed'
);

// -- Double-quote imports --

defineInlineTest(
  transform,
  OPTS,
  `import { Button } from "antd";\nconst App = () => <Button type="primary">Ok</Button>;`,
  `import { Button } from '@openmetadata/ui-core-components';\nconst App = () => <Button color='primary'>Ok</Button>;`,
  'double-quoted antd import is matched the same as single-quoted'
);

// -- Multi-specifier antd import keeps siblings --

defineInlineTest(
  transform,
  OPTS,
  `import { Button, Modal } from 'antd';\nconst App = () => (\n  <>\n    <Modal />\n    <Button type="primary">Ok</Button>\n  </>\n);`,
  `import { Modal } from 'antd';\nimport { Button } from '@openmetadata/ui-core-components';\nconst App = () => (\n  <>\n    <Modal />\n    <Button color='primary'>Ok</Button>\n  </>\n);`,
  'multi-specifier antd import keeps sibling specifiers (Modal) on antd'
);

// -- Merges into an existing core import when fully converted --

defineInlineTest(
  transform,
  OPTS,
  `import { Card } from '@openmetadata/ui-core-components';\nimport { Button } from 'antd';\nconst App = () => (\n  <>\n    <Card />\n    <Button type="primary">Ok</Button>\n  </>\n);`,
  `import { Card, Button } from '@openmetadata/ui-core-components';\nconst App = () => (\n  <>\n    <Card />\n    <Button color='primary'>Ok</Button>\n  </>\n);`,
  'merges into an existing core import when fully converted'
);

// -- No-op when the file doesn't import Button from antd at all --

defineInlineTest(
  transform,
  OPTS,
  `import { Modal } from 'antd';\nconst App = () => <Modal />;`,
  `import { Modal } from 'antd';\nconst App = () => <Modal />;`,
  'no-op when the file does not import Button from antd (or the subpath) at all'
);

describe('console.warn reporting', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns with the file path and skip reason for a dynamic size', () => {
    transform(
      {
        path: 'src/components/Foo.tsx',
        source: `import { Button } from 'antd';\nconst App = ({ sz }) => <Button size={sz}>Click</Button>;`,
      },
      { jscodeshift: require('jscodeshift').withParser('tsx') }
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(message).toContain('src/components/Foo.tsx');
    expect(message).toContain('dynamic-size');
  });

  it('warns for the loading={{ delay }} object form', () => {
    transform(
      {
        path: 'src/components/Bar.tsx',
        source: `import { Button } from 'antd';\nconst App = () => <Button loading={{ delay: 200 }}>Click</Button>;`,
      },
      { jscodeshift: require('jscodeshift').withParser('tsx') }
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(message).toContain('loading-object');
  });

  it('warns for shape-unsupported', () => {
    transform(
      {
        path: 'src/components/Baz.tsx',
        source: `import { Button } from 'antd';\nconst App = () => <Button shape="round">X</Button>;`,
      },
      { jscodeshift: require('jscodeshift').withParser('tsx') }
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(message).toContain('shape-unsupported');
  });

  it('warns for Button.Group', () => {
    transform(
      {
        path: 'src/components/Qux.tsx',
        source: `import { Button } from 'antd';\nconst App = () => <Button.Group>Hi</Button.Group>;`,
      },
      { jscodeshift: require('jscodeshift').withParser('tsx') }
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(message).toContain('button-group');
  });

  it('warns for the ButtonGroup subpath import without touching it', () => {
    transform(
      {
        path: 'src/components/Quux.tsx',
        source: `import ButtonGroup from 'antd/lib/button/button-group';\nconst App = () => <ButtonGroup>Hi</ButtonGroup>;`,
      },
      { jscodeshift: require('jscodeshift').withParser('tsx') }
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(message).toContain('button-group-subpath');
  });

  it('warns with ghost-remap for a converted (not skipped) ghost element', () => {
    transform(
      {
        path: 'src/components/Ghost.tsx',
        source: `import { Button } from 'antd';\nconst App = () => <Button ghost>Click</Button>;`,
      },
      { jscodeshift: require('jscodeshift').withParser('tsx') }
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(message).toContain('converted-with-warnings');
    expect(message).toContain('ghost-remap');
  });

  it('does not warn when everything converts cleanly', () => {
    transform(
      {
        path: 'src/components/Clean.tsx',
        source: `import { Button } from 'antd';\nconst App = () => <Button type="primary">Ok</Button>;`,
      },
      { jscodeshift: require('jscodeshift').withParser('tsx') }
    );

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
