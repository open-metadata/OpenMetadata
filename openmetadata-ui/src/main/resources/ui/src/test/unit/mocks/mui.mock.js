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
  Button: ({ children, endIcon, ...props }) => (
    <button data-testid={props['data-testid']} onClick={props.onClick}>
      {children}
      {endIcon}
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
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8',
        blue: {
          500: '#1890ff',
          600: '#1976d2',
        },
        green: {
          500: '#4caf50',
        },
        red: {
          500: '#f44336',
        },
        orange: {
          500: '#ff9800',
        },
        gray: {
          300: '#d1d1d1',
          400: '#bdbdbd',
          700: '#616161',
        },
        brand: {
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
