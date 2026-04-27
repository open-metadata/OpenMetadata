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

Object.assign(global, {
  TextDecoder,
  TextEncoder,
  structuredClone: (v) => JSON.parse(JSON.stringify(v)),
});

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
  descriptionTableObject: jest.fn().mockReturnValue([]),
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
 * Note: We keep the actual ThemeProvider so tests can wrap components properly
 */
jest.mock('@mui/material/styles', () => {
  const actual = jest.requireActual('@mui/material/styles');

  return {
    ...actual,
  };
});

/**
 * Mock @mui/styled-engine to prevent styled-components/emotion conflicts in tests
 * Note: We keep ThemeContext from the actual package to allow ThemeProvider to work properly
 */
jest.mock('@mui/styled-engine', () => {
  const actual = jest.requireActual('@mui/styled-engine');

  const React = require('react');

  const styled = (component) => () => {
    return React.forwardRef((props, ref) => {
      return React.createElement(component, { ...props, ref });
    });
  };

  return {
    ...actual,
    __esModule: true,
    default: styled,
    styled,
    keyframes: () => 'mock-keyframes',
    css: (...args) => args,
    internal_mutateStyles: jest.fn(),
    internal_serializeStyles: jest.fn(),
  };
});

/**
 * Mock @mui/material components for consistent testing
 */
jest.mock('@mui/material', () => {
  const React = require('react');

  const styled = (component) => () => component;

  return {
    ...jest.requireActual('@mui/material'),
    Button: React.forwardRef(({ children, onClick, ...props }, ref) =>
      React.createElement(
        'button',
        { ...props, onClick, ref, 'data-testid': props['data-testid'] },
        children
      )
    ),
    Grid: React.forwardRef(({ children, ...props }, ref) =>
      React.createElement(
        'div',
        { ...props, ref, 'data-testid': props['data-testid'] },
        children
      )
    ),
    styled,
  };
});

/**
 * Mock @openmetadata/ui-core-components so tests that transitively import
 * from the package (via ExpandableCard, DescriptionV1, widget shells, etc.)
 * do not need to spin up the full react-aria-components / MUI styled engine
 * inside jsdom. Lightweight DOM shims preserve data-testid, className, and
 * event handlers — matching the pattern used elsewhere in the suite.
 */
jest.mock('@openmetadata/ui-core-components', () => {
  const React = require('react');

  const Box = React.forwardRef(({ children, className, ...rest }, ref) =>
    React.createElement('div', { ...rest, ref, className }, children)
  );

  const Typography = ({
    children,
    className,
    as: Component = 'span',
    ...rest
  }) => React.createElement(Component, { ...rest, className }, children);

  const Card = React.forwardRef(({ children, className, ...rest }, ref) =>
    React.createElement('div', { ...rest, ref, className }, children)
  );
  Card.Header = ({ title, extra, className, ...rest }) =>
    React.createElement('div', { ...rest, className }, [
      title && React.createElement('div', { key: 'title' }, title),
      extra && React.createElement('div', { key: 'extra' }, extra),
    ]);
  Card.Content = ({ children, className, ...rest }) =>
    React.createElement('div', { ...rest, className }, children);
  Card.Footer = ({ children, className, ...rest }) =>
    React.createElement('div', { ...rest, className }, children);

  const renderIcon = (icon) => {
    if (!icon) {
      return null;
    }
    if (React.isValidElement(icon)) {
      return icon;
    }
    if (typeof icon === 'function') {
      return React.createElement(icon, {});
    }

    return null;
  };

  const ButtonUtility = ({
    onClick,
    isDisabled,
    tabIndex,
    className,
    tooltip,
    icon,
    'data-testid': testId,
  }) =>
    React.createElement(
      'button',
      {
        'aria-label': tooltip,
        className,
        'data-testid': testId,
        disabled: isDisabled,
        onClick,
        tabIndex,
        type: 'button',
      },
      renderIcon(icon)
    );

  const Avatar = ({ children, ...rest }) =>
    React.createElement('div', { ...rest }, children);

  const Badge = ({ children, className, 'data-testid': testId, ...rest }) =>
    React.createElement(
      'span',
      { className, 'data-testid': testId, ...rest },
      children
    );

  const Grid = ({ children, className, style, ...rest }) =>
    React.createElement('div', { ...rest, className, style }, children);
  Grid.Item = ({ children, className, style, ...rest }) =>
    React.createElement('div', { ...rest, className, style }, children);

  const DropdownRoot = ({ children }) =>
    React.createElement(React.Fragment, null, children);
  const DropdownPopover = ({ children, className }) =>
    React.createElement('div', { className }, children);
  const DropdownMenu = ({ children, items }) => {
    if (typeof children === 'function' && Array.isArray(items)) {
      return React.createElement(
        'div',
        null,
        items.map((item, index) =>
          React.createElement(
            React.Fragment,
            { key: item?.key ?? item?.id ?? index },
            children(item)
          )
        )
      );
    }

    return React.createElement('div', null, children);
  };
  const DropdownItem = ({ label, id, isDisabled, onAction, children }) =>
    React.createElement(
      'button',
      {
        'data-id': id,
        disabled: isDisabled,
        onClick: onAction,
        type: 'button',
      },
      label ?? children
    );
  const DropdownSection = ({ children }) =>
    React.createElement('div', null, children);
  const DropdownSectionHeader = ({ children }) =>
    React.createElement('div', null, children);
  const DropdownSeparator = () => React.createElement('hr', null);
  const DropdownDotsButton = (props) =>
    React.createElement('button', { ...props, type: 'button' });

  const Dropdown = {
    Root: DropdownRoot,
    Popover: DropdownPopover,
    Menu: DropdownMenu,
    Section: DropdownSection,
    SectionHeader: DropdownSectionHeader,
    Item: DropdownItem,
    Separator: DropdownSeparator,
    DotsButton: DropdownDotsButton,
  };

  return {
    Box,
    Card,
    Typography,
    ButtonUtility,
    Avatar,
    Badge,
    Grid,
    Dropdown,
    createMuiTheme: () =>
      require('@mui/material/styles').createTheme({
        palette: {
          allShades: new Proxy(
            {},
            {
              get: () =>
                new Proxy(
                  {},
                  {
                    get: () => '#ffffff',
                  }
                ),
            }
          ),
        },
      }),
    Tooltip: ({ children, title }) =>
      React.createElement(React.Fragment, null, [
        children,
        title ? React.createElement('span', { key: 'title' }, title) : null,
      ]),
    TooltipTrigger: ({ children }) => children,
    Button: ({ children, onClick, ...rest }) =>
      React.createElement(
        'button',
        { ...rest, onClick, type: 'button' },
        children
      ),
    Toggle: ({ isSelected, onChange, isDisabled, 'data-testid': testId }) =>
      React.createElement('button', {
        'aria-checked': isSelected,
        'aria-disabled': isDisabled,
        'data-testid': testId,
        role: 'switch',
        onClick: () => onChange?.(!isSelected),
        type: 'button',
      }),
    SlideoutMenu: ({ children }) =>
      React.createElement(React.Fragment, null, children),
    Drawer: ({ children }) => children,
    Elevation: ({ children }) => children,
    NavList: ({ children }) => children,
    NavItemBase: ({ children }) => children,
    NavItemButton: ({ children }) => children,
    Tabs: ({ children }) => children,
    Table: ({ children }) => children,
    ModalOverlay: ({ children, isOpen }) =>
      isOpen === false ? null : children,
    Modal: ({ children }) => children,
    Dialog: Object.assign(
      ({ children, title, 'data-testid': testId }) =>
        React.createElement('div', { 'data-testid': testId, role: 'dialog' }, [
          title ? React.createElement('h2', { key: 'title' }, title) : null,
          children,
        ]),
      {
        Header: ({ children, title }) =>
          React.createElement('div', null, [
            title ? React.createElement('h3', { key: 'title' }, title) : null,
            children,
          ]),
        Content: ({ children }) => React.createElement('div', null, children),
        Footer: ({ children }) => React.createElement('div', null, children),
      }
    ),
    DialogTrigger: ({ children }) =>
      React.createElement(React.Fragment, null, children),
    Heading: ({ children }) => React.createElement('h2', null, children),
    Alert: ({ title, children, className, ...rest }) =>
      React.createElement('div', { ...rest, className, role: 'alert' }, [
        title ? React.createElement('strong', { key: 'title' }, title) : null,
        children,
      ]),
    Skeleton: ({ className, style, 'data-testid': testId }) =>
      React.createElement('div', {
        className,
        'data-testid': testId,
        style,
      }),
    Checkbox: ({
      label,
      isSelected,
      onChange,
      isDisabled,
      className,
      'data-testid': testId,
    }) =>
      React.createElement(
        'label',
        { className, 'data-testid': testId },
        React.createElement('input', {
          checked: !!isSelected,
          disabled: isDisabled,
          onChange: (e) => onChange?.(e.target.checked),
          type: 'checkbox',
        }),
        label
      ),
  };
});

jest.mock('./utils/i18next/LocalUtil', () => {
  const React = require('react');

  return {
    Transi18next: jest
      .fn()
      .mockImplementation(({ i18nKey, renderElement, values }) => {
        const valueArr = Object.values(values ?? {});

        return React.createElement('div', { 'data-testid': i18nKey }, [
          i18nKey,
          renderElement,
          valueArr,
        ]);
      }),
    __esModule: true,
    default: {
      t: jest.fn().mockImplementation((key) => key),
      on: jest.fn(),
    },
    t: jest.fn().mockImplementation((key) => key),
    translateWithNestedKeys: jest.fn().mockImplementation((key, params) => {
      return params ? `${key}_${JSON.stringify(params)}` : key;
    }),
  };
});
