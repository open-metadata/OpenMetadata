/*
 *  Copyright 2026 Collate.
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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { FilterResourceDescriptor } from '../../../../../../generated/events/filterResourceDescriptor';
import NotificationSourceSelect from './NotificationSourceSelect';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Box: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  Card: Object.assign(
    jest
      .fn()
      .mockImplementation(({ children, ...props }) => (
        <div {...props}>{children}</div>
      )),
    {
      Content: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
    }
  ),
  Typography: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
  Select: Object.assign(
    jest.fn().mockImplementation(({ children, isDisabled, ...props }) => (
      <div
        aria-disabled={isDisabled}
        data-testid={props['data-testid'] ?? 'select'}
        role="listbox">
        {typeof children === 'function'
          ? props.items?.map((item: { id: string; label: string }) =>
              children(item)
            )
          : children}
      </div>
    )),
    {
      Item: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
    }
  ),
  Button: jest
    .fn()
    .mockImplementation(({ children, onPress, ...props }) => (
      <button {...props} onClick={onPress}>
        {children}
      </button>
    )),
  Dropdown: {
    Root: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
    Popover: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
    Menu: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
    Item: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
  },
}));

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityNameLabel: (name: string) => name,
}));

jest.mock('../../../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityIconWithBg: jest.fn(() => null),
  },
}));

jest.mock('../../../../../../utils/EntityIconUtils', () => ({
  EntityIconSize: { Size14: 14 },
}));

const mockFilterResources: FilterResourceDescriptor[] = [
  { name: 'table' },
  { name: 'topic' },
] as FilterResourceDescriptor[];

describe('NotificationSourceSelect', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render add source button when no value selected', () => {
    render(
      <NotificationSourceSelect
        filterResources={mockFilterResources}
        value={[]}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByTestId('add-source-button')).toBeInTheDocument();
    expect(screen.queryByTestId('source-select')).not.toBeInTheDocument();
  });

  it('should render select dropdown when value is selected', () => {
    render(
      <NotificationSourceSelect
        filterResources={mockFilterResources}
        value={['table']}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByTestId('source-select')).toBeInTheDocument();
    expect(
      screen.queryByTestId('add-source-button')
    ).not.toBeInTheDocument();
  });

  it('should disable select in view mode', () => {
    render(
      <NotificationSourceSelect
        isViewMode
        filterResources={mockFilterResources}
        value={['table']}
        onChange={mockOnChange}
      />
    );

    const select = screen.getByTestId('source-select');

    expect(select).toHaveAttribute('aria-disabled', 'true');
  });
});
