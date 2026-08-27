'use strict';
const { defineInlineTest } = require('jscodeshift/dist/testUtils');
const transform = require('../transforms/antd-tooltip-to-core');

const OPTS = {};

const CORE_BUTTON = `import { Button } from '@openmetadata/ui-core-components';\n`;

// -- the happy path: a core Button child is a valid react-aria trigger --

defineInlineTest(
  transform,
  OPTS,
  `${CORE_BUTTON}import { Tooltip } from 'antd';\nconst App = () => <Tooltip title="Hi"><Button>Go</Button></Tooltip>;`,
  `import { Button, Tooltip } from '@openmetadata/ui-core-components';\nconst App = () => <Tooltip title="Hi"><Button>Go</Button></Tooltip>;`,
  'a Tooltip wrapping a core Button moves to the core import'
);

// -- placement vocabulary --
//
// antd uses camelCase compass placements; react-aria uses space-separated
// pairs. react-aria does not error on an unknown value, it silently falls back
// to its default placement, so an untranslated value is a visual-only bug.

defineInlineTest(
  transform,
  OPTS,
  `${CORE_BUTTON}import { Tooltip } from 'antd';\nconst App = () => <Tooltip placement="topLeft" title="Hi"><Button>Go</Button></Tooltip>;`,
  `import { Button, Tooltip } from '@openmetadata/ui-core-components';\nconst App = () => <Tooltip placement='top left' title="Hi"><Button>Go</Button></Tooltip>;`,
  'placement="topLeft" becomes placement="top left"'
);

defineInlineTest(
  transform,
  OPTS,
  `${CORE_BUTTON}import { Tooltip } from 'antd';\nconst App = () => <Tooltip placement="bottomRight" title="Hi"><Button>Go</Button></Tooltip>;`,
  `import { Button, Tooltip } from '@openmetadata/ui-core-components';\nconst App = () => <Tooltip placement='bottom right' title="Hi"><Button>Go</Button></Tooltip>;`,
  'placement="bottomRight" becomes placement="bottom right"'
);

defineInlineTest(
  transform,
  OPTS,
  `${CORE_BUTTON}import { Tooltip } from 'antd';\nconst App = () => <Tooltip placement="bottom" title="Hi"><Button>Go</Button></Tooltip>;`,
  `import { Button, Tooltip } from '@openmetadata/ui-core-components';\nconst App = () => <Tooltip placement='bottom' title="Hi"><Button>Go</Button></Tooltip>;`,
  'a placement that is already valid passes through unchanged'
);

defineInlineTest(
  transform,
  OPTS,
  `${CORE_BUTTON}import { Tooltip } from 'antd';\nconst App = () => <Tooltip placement={p} title="Hi"><Button>Go</Button></Tooltip>;`,
  `${CORE_BUTTON}import { Tooltip } from 'antd';\nconst App = () => <Tooltip placement={p} title="Hi"><Button>Go</Button></Tooltip>;`,
  'a computed placement cannot be checked, so the file is left for hand-finish'
);

// -- destroyTooltipOnHide is react-aria's default, so it is dropped --

defineInlineTest(
  transform,
  OPTS,
  `${CORE_BUTTON}import { Tooltip } from 'antd';\nconst App = () => <Tooltip destroyTooltipOnHide title="Hi"><Button>Go</Button></Tooltip>;`,
  `import { Button, Tooltip } from '@openmetadata/ui-core-components';\nconst App = () => <Tooltip title="Hi"><Button>Go</Button></Tooltip>;`,
  'destroyTooltipOnHide is dropped rather than forwarded to the DOM'
);

// -- trigger validity is decided by the import source, not the child's name --
//
// react-aria opens a tooltip from the trigger's focus/hover handlers, which it
// passes down through FocusableContext. An antd Button never reads that
// context, so a Tooltip around one renders no error and simply never opens.

defineInlineTest(
  transform,
  OPTS,
  `import { Button, Tooltip } from 'antd';\nconst App = () => <Tooltip title="Hi"><Button>Go</Button></Tooltip>;`,
  `import { Button, Tooltip } from 'antd';\nconst App = () => <Tooltip title="Hi"><Button>Go</Button></Tooltip>;`,
  'a Button still imported from antd is not a valid trigger, so the file is skipped'
);

defineInlineTest(
  transform,
  OPTS,
  `import { Tooltip } from 'antd';\nconst App = () => <Tooltip title="Hi"><span>Go</span></Tooltip>;`,
  `import { Tooltip } from 'antd';\nconst App = () => <Tooltip title="Hi"><span>Go</span></Tooltip>;`,
  'a non-focusable child is skipped rather than silently losing its tooltip'
);

// -- props with no core equivalent --

defineInlineTest(
  transform,
  OPTS,
  `${CORE_BUTTON}import { Tooltip } from 'antd';\nconst App = () => <Tooltip overlayClassName="x" title="Hi"><Button>Go</Button></Tooltip>;`,
  `${CORE_BUTTON}import { Tooltip } from 'antd';\nconst App = () => <Tooltip overlayClassName="x" title="Hi"><Button>Go</Button></Tooltip>;`,
  'an unsupported antd-only prop leaves the file for hand-finish'
);

// -- the antd import is only dropped when nothing else needs it --

defineInlineTest(
  transform,
  OPTS,
  `${CORE_BUTTON}import { Space, Tooltip } from 'antd';\nconst App = () => <Space><Tooltip title="Hi"><Button>Go</Button></Tooltip></Space>;`,
  `import { Button, Tooltip } from '@openmetadata/ui-core-components';\nimport { Space } from 'antd';\nconst App = () => <Space><Tooltip title="Hi"><Button>Go</Button></Tooltip></Space>;`,
  'other antd named imports are preserved'
);

// -- antd overlays inject handlers into their immediate child --
//
// antd's Popover/Dropdown open by cloning the child and injecting an onClick.
// antd's Tooltip forwards that on; core's does not, so converting a Tooltip
// nested in one leaves the *outer* overlay permanently closed - and nothing
// about the Tooltip itself looks wrong.

defineInlineTest(
  transform,
  OPTS,
  `${CORE_BUTTON}import { Popover, Tooltip } from 'antd';\nconst App = () => <Popover content={c} trigger="click"><Tooltip title="Hi"><Button>Go</Button></Tooltip></Popover>;`,
  `${CORE_BUTTON}import { Popover, Tooltip } from 'antd';\nconst App = () => <Popover content={c} trigger="click"><Tooltip title="Hi"><Button>Go</Button></Tooltip></Popover>;`,
  'a Tooltip directly inside an antd Popover is skipped'
);

defineInlineTest(
  transform,
  OPTS,
  `${CORE_BUTTON}import { Dropdown, Tooltip } from 'antd';\nconst App = () => <Dropdown menu={m}><Tooltip title="Hi"><Button>Go</Button></Tooltip></Dropdown>;`,
  `${CORE_BUTTON}import { Dropdown, Tooltip } from 'antd';\nconst App = () => <Dropdown menu={m}><Tooltip title="Hi"><Button>Go</Button></Tooltip></Dropdown>;`,
  'a Tooltip directly inside an antd Dropdown is skipped'
);

// -- a Tooltip with no title --
//
// antd renders no tooltip at all without a title; core always renders the
// bubble, so converting one produces an empty tooltip on hover. These
// wrappers are dead weight and should be deleted, not migrated.

defineInlineTest(
  transform,
  OPTS,
  `${CORE_BUTTON}import { Tooltip } from 'antd';\nconst App = () => <Tooltip><Button>Go</Button></Tooltip>;`,
  `${CORE_BUTTON}import { Tooltip } from 'antd';\nconst App = () => <Tooltip><Button>Go</Button></Tooltip>;`,
  'a Tooltip with no title is skipped rather than turned into an empty bubble'
);
