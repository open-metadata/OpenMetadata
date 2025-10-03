/*
 *  Copyright 2022 Collate.
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

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/extend-expect';

// Polyfill for TextEncoder and TextDecoder
import { TextDecoder, TextEncoder } from 'util';

// eslint-disable-next-line no-undef
Object.assign(global, { TextDecoder, TextEncoder });

// Reference: https://github.com/ant-design/ant-design/issues/21096
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Error:- range(...).getBoundingClientRect is not a function
// Reference: https://github.com/jsdom/jsdom/issues/3002#issuecomment-655752934
document.createRange = () => {
  const range = new Range();

  range.getBoundingClientRect = jest.fn();

  range.getClientRects = () => {
    return {
      item: () => null,
      length: 0,
      [Symbol.iterator]: jest.fn(),
    };
  };

  return range;
};

window.DOMMatrixReadOnly = jest.fn().mockImplementation(() => ({
  is2D: true,
  isIdentity: true,
}));

window.BroadcastChannel = jest.fn().mockImplementation(() => ({
  postMessage: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn(),
}));

/**
 * mock implementation of ResizeObserver
 */
window.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

/**
 * mock implementation of IntersectionObserver
 */
window.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

/**
 * mock i18next
 */

jest.mock('i18next', () => ({
  ...jest.requireActual('i18next'),
  use: jest.fn(),
  init: jest.fn(),
  t: jest.fn().mockImplementation((key) => key),
}));

jest.mock('utils/i18next/LocalUtil', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key) => key,
  }),
  detectBrowserLanguage: jest.fn().mockReturnValue('en-US'),
  t: (key) => key,
  dir: jest.fn().mockReturnValue('ltr'),
}));
/**
 * mock react-i18next
 */
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: jest.fn().mockReturnValue({
    t: (key) => key,
    i18n: { language: 'en-US', dir: jest.fn().mockReturnValue('ltr') },
  }),
}));

jest.mock('./utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('./components/ActivityFeed/FeedEditor/FeedEditor.tsx', () => ({
  FeedEditor: jest.fn().mockImplementation(() => 'FeedEditor'),
}));
/**
 * Global mock for TableColumn.util to prevent ownerTableObject errors
 */
jest.mock('./utils/TableColumn.util', () => ({
  ownerTableObject: jest.fn().mockReturnValue([]),
  domainTableObject: jest.fn().mockReturnValue([]),
  dataProductTableObject: jest.fn().mockReturnValue([]),
  tagTableObject: jest.fn().mockReturnValue([]),
  columnFilterIcon: jest.fn(),
}));

/**
 * Global mock for AdvancedSearchClassBase to fix circular dependency issues
 */
jest.mock('./utils/AdvancedSearchClassBase', () => {
  const actual = jest.requireActual('./utils/AdvancedSearchClassBase');

  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual.default,
      autocomplete: jest.fn().mockReturnValue(jest.fn()),
      getQbConfigs: jest.fn().mockReturnValue({}),
    },
  };
});

jest.mock('./utils/EnvironmentUtils', () => ({
  isDev: jest.fn().mockReturnValue('test'),
}));

/**
 * Mock MUI theme to provide proper theme context
 */
jest.mock('@mui/material/styles', () => {
  const actual = jest.requireActual('@mui/material/styles');
  const { createTheme } = actual;

  const createMockPalette = () => {
    return new Proxy(
      {},
      {
        get: (target, prop) => {
          if (typeof prop === 'string') {
            return new Proxy(
              {},
              {
                get: (colorTarget, colorProp) => {
                  return `#mock-${prop}-${String(colorProp)}`;
                },
              }
            );
          }

          return undefined;
        },
      }
    );
  };

  const baseTheme = createTheme();
  const mockTheme = {
    ...baseTheme,
    palette: {
      ...baseTheme.palette,
      allShades: createMockPalette(),
    },
  };

  return {
    ...actual,
    useTheme: jest.fn().mockReturnValue(mockTheme),
    ThemeProvider: ({ children }) => children,
  };
});

/**
 * Mock @mui/system useTheme to provide theme context
 */
jest.mock('@mui/system', () => {
  const actual = jest.requireActual('@mui/system');

  const createMockPalette = () => {
    return new Proxy(
      {},
      {
        get: () => new Proxy({}, { get: () => '#mock-color' }),
      }
    );
  };

  // Use a minimal but complete theme structure
  const mockTheme = {
    palette: { allShades: createMockPalette() },
    spacing: (factor) => `${8 * (factor || 1)}px`,
    breakpoints: { up: () => '', down: () => '', values: {} },
    transitions: {
      create: () => '',
      duration: {},
      easing: {},
      getAutoHeightDuration: () => 200,
    },
    shadows: new Array(25).fill('none'),
    shape: { borderRadius: 4 },
    zIndex: {},
  };

  return {
    ...actual,
    useTheme: jest.fn().mockReturnValue(mockTheme),
  };
});

/**
 * Mock @mui/styled-engine to prevent styled-components/emotion conflicts in tests
 */
jest.mock('@mui/styled-engine', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');

  const styled = (component) => () => {
    return React.forwardRef((props, ref) => {
      return React.createElement(component, { ...props, ref });
    });
  };

  return {
    __esModule: true,
    default: styled,
    styled,
    ThemeProvider: ({ children }) => children,
    keyframes: () => 'mock-keyframes',
    css: (...args) => args,
    internal_mutateStyles: jest.fn(),
    internal_serializeStyles: jest.fn(),
  };
});
