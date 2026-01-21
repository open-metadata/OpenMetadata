/*
 *  Copyright 2024 Collate.
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

import React from 'react';
window.React = React;

/**
 * Global mock for Material-UI (MUI) components
 * This mock resolves Jest compatibility issues with MUI Grid v2 and theme context
 * Usage: Import this file at the top of test files that use MUI components
 * import '../../../test/unit/mocks/mui.mock';
 */

jest.mock('@mui/material', () => ({
  Box: ({ children, ...props }) => (
    <div data-testid={props['data-testid']}>{children}</div>
  ),
  Card: ({ children, ...props }) => (
    <div data-testid={props['data-testid']}>{children}</div>
  ),
  CardContent: ({ children, ...props }) => (
    <div data-testid={props['data-testid']}>{children}</div>
  ),
  Stack: ({ children, ...props }) => (
    <div data-testid={props['data-testid']}>{children}</div>
  ),
  Grid: ({ children, ...props }) => (
    <div data-testid={props['data-testid']}>{children}</div>
  ),
  Typography: ({ children, ...props }) => (
    <span data-testid={props['data-testid']}>{children}</span>
  ),
  Tabs: ({ children, ...props }) => (
    <div data-testid={props['data-testid']}>{children}</div>
  ),
  Tab: ({ label, ...props }) => (
    <button data-testid={props['data-testid']}>{label}</button>
  ),
  Divider: () => <hr />,
  Skeleton: () => <div data-testid="skeleton">Loading...</div>,
  Button: ({ children, ...props }) => (
    <button data-testid={props['data-testid']} onClick={props.onClick}>
      {children}
    </button>
  ),
  IconButton: ({ children, ...props }) => (
    <button data-testid={props['data-testid']} onClick={props.onClick}>
      {children}
    </button>
  ),
  Chip: ({ label, ...props }) => (
    <span data-testid={props['data-testid']}>{label}</span>
  ),
  Tooltip: ({ children, title }) => <div title={title}>{children}</div>,
  Menu: ({ children, ...props }) => (
    <div data-testid={props['data-testid']} role="menu">
      {props.open ? children : null}
    </div>
  ),
  MenuItem: ({ children, ...props }) => (
    <div
      data-testid={props['data-testid']}
      role="menuitem"
      onClick={props.onClick}>
      {children}
    </div>
  ),
  Select: ({ children, value, onChange, ...props }) => (
    <select
      data-testid={props['data-testid']}
      value={value}
      onChange={(e) =>
        onChange && onChange({ target: { value: e.target.value } })
      }>
      {children}
    </select>
  ),
  FormControl: ({ children, ...props }) => (
    <div data-testid={props['data-testid']}>{children}</div>
  ),
  InputLabel: ({ children, ...props }) => (
    <label data-testid={props['data-testid']}>{children}</label>
  ),
  Radio: ({ ...props }) => (
    <input data-testid={props['data-testid']} type="radio" {...props} />
  ),
  RadioGroup: ({ children, ...props }) => (
    <div data-testid={props['data-testid']} role="radiogroup">
      {children}
    </div>
  ),
  FormControlLabel: ({ label, control, ...props }) => (
    <label data-testid={props['data-testid']}>
      {control}
      {label}
    </label>
  ),
  CircularProgress: ({ ...props }) => (
    <div data-testid={props['data-testid']}>Loading...</div>
  ),
  Modal: ({ children, open, ...props }) =>
    open ? <div data-testid={props['data-testid']}>{children}</div> : null,
  styled: (component) => () => component,
  useTheme: () => ({
    palette: {
      grey: {
        50: '#fafafa',
        100: '#f5f5f5',
        200: '#eeeeee',
        300: '#e0e0e0',
        400: '#bdbdbd',
        500: '#9e9e9e',
        600: '#757575',
        700: '#616161',
        800: '#424242',
        900: '#212121',
      },
      primary: {
        main: '#1976d2',
        dark: '#115293',
        contrastText: '#ffffff',
      },
      common: {
        white: '#ffffff',
        black: '#000000',
      },
      allShades: {
        white: '#ffffff',
        black: '#000000',
        success: {
          50: '#e8f5e9',
          100: '#c8e6c9',
          200: '#a5d6a7',
          300: '#81c784',
          400: '#66bb6a',
          500: '#4caf50',
          600: '#43a047',
          700: '#388e3c',
          800: '#2e7d32',
          900: '#1b5e20',
        },
        error: {
          50: '#ffebee',
          100: '#ffcdd2',
          200: '#ef9a9a',
          300: '#e57373',
          400: '#ef5350',
          500: '#f44336',
          600: '#e53935',
          700: '#d32f2f',
          800: '#c62828',
          900: '#b71c1c',
        },
        warning: {
          50: '#fff8e1',
          100: '#ffecb3',
          500: '#ff9800',
          700: '#f57c00',
        },
        info: {
          50: '#e3f2fd',
          500: '#2196f3',
          700: '#1976d2',
        },
        blue: {
          50: '#e3f2fd',
          500: '#1890ff',
          600: '#1976d2',
          700: '#1565c0',
        },
        green: {
          50: '#e8f5e9',
          500: '#4caf50',
          700: '#388e3c',
        },
        red: {
          50: '#ffebee',
          500: '#f44336',
          700: '#d32f2f',
        },
        orange: {
          50: '#fff3e0',
          500: '#ff9800',
          700: '#f57c00',
        },
        gray: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#eeeeee',
          300: '#d1d1d1',
          400: '#bdbdbd',
          500: '#9e9e9e',
          600: '#757575',
          700: '#616161',
        },
        brand: {
          50: '#e8eaf6',
          700: '#d1d1d1',
        },
      },
    },
    typography: {
      pxToRem: (size) => `${size}px`,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
    },
    spacing: (factor) => `${factor * 8}px`,
  }),
}));
