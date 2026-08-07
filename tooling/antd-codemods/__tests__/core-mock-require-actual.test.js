'use strict';

const { defineInlineTest } = require('jscodeshift/dist/testUtils');
const transform = require('../transforms/core-mock-require-actual');

const t = (name, input, expected) =>
  defineInlineTest(transform, {}, input, expected, name);

t(
  'spreads requireActual into an expression-body factory',
  `jest.mock('@openmetadata/ui-core-components', () => ({
  Typography: jest.fn(),
}));`,
  `jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Typography: jest.fn()
}));`
);

t(
  'spreads requireActual into a block-body factory',
  `jest.mock('@openmetadata/ui-core-components', () => {
  return { Typography: jest.fn() };
});`,
  `jest.mock('@openmetadata/ui-core-components', () => {
  return {
    ...jest.requireActual('@openmetadata/ui-core-components'),
    Typography: jest.fn()
  };
});`
);

// The spread goes first so explicit overrides still take precedence - that is
// the whole point of the mock.
t(
  'keeps explicit overrides winning over the real module',
  `jest.mock('@openmetadata/ui-core-components', () => ({
  Button: 'MockButton',
  Typography: 'MockTypography',
}));`,
  `jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Button: 'MockButton',
  Typography: 'MockTypography'
}));`
);

t(
  'leaves a mock that already spreads requireActual untouched',
  `jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Typography: jest.fn(),
}));`,
  `jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Typography: jest.fn(),
}));`
);

t(
  'leaves mocks of other modules untouched',
  `jest.mock('antd', () => ({ Button: jest.fn() }));`,
  `jest.mock('antd', () => ({ Button: jest.fn() }));`
);

// A module-factory mock with no object literal (e.g. returning a variable)
// cannot be safely extended, so it is left for a human.
t(
  'leaves a factory that does not return an object literal untouched',
  `jest.mock('@openmetadata/ui-core-components', () => mockModule);`,
  `jest.mock('@openmetadata/ui-core-components', () => mockModule);`
);
