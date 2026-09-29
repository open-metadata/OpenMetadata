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

import { fireEvent, render, screen } from '@testing-library/react';
import { Effect } from '../../../../../../generated/events/api/createEventSubscription';
import {
  EventFilterRule,
  InputType,
} from '../../../../../../generated/events/eventSubscription';
import NotificationFiltersEditor from './NotificationFiltersEditor';

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
  Button: jest
    .fn()
    .mockImplementation(({ children, onPress, isDisabled, ...props }) => (
      <button {...props} disabled={isDisabled} onClick={onPress}>
        {children}
      </button>
    )),
  Select: Object.assign(
    jest
      .fn()
      .mockImplementation(({ children, ...props }) => (
        <div data-testid={props['data-testid'] ?? 'select'}>
          {typeof children === 'function' ? null : children}
        </div>
      )),
    {
      Item: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
    }
  ),
  Toggle: jest
    .fn()
    .mockImplementation(({ onChange, isSelected, ...props }) => (
      <input
        {...props}
        checked={isSelected}
        type="checkbox"
        onChange={(e) => onChange?.(e.target.checked)}
      />
    )),
}));

jest.mock('@untitledui/icons', () => ({
  XClose: jest.fn(() => <span>X</span>),
}));

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityName: (entity: { name?: string; displayName?: string }) =>
    entity?.displayName ?? entity?.name ?? '',
}));

jest.mock('./NotificationAlertArgFields', () => ({
  getControlledArgumentFieldCoreUI: jest.fn(() => null),
}));

const mockSupportedFilters: EventFilterRule[] = [
  {
    name: 'filterA',
    displayName: 'Filter A',
    inputType: InputType.None,
    arguments: [],
  } as unknown as EventFilterRule,
  {
    name: 'filterB',
    displayName: 'Filter B',
    inputType: InputType.None,
    arguments: [],
  } as unknown as EventFilterRule,
];

describe('NotificationFiltersEditor', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render add filter button when source is selected', () => {
    render(
      <NotificationFiltersEditor
        selectedResources={['table']}
        supportedFilters={mockSupportedFilters}
        value={[]}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByTestId('add-filters')).toBeInTheDocument();
  });

  it('should disable add filter button when no source selected', () => {
    render(
      <NotificationFiltersEditor
        supportedFilters={mockSupportedFilters}
        value={[]}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByTestId('add-filters')).toBeDisabled();
  });

  it('should add a filter row when add button is clicked', () => {
    render(
      <NotificationFiltersEditor
        selectedResources={['table']}
        supportedFilters={mockSupportedFilters}
        value={[]}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByTestId('add-filters'));

    expect(mockOnChange).toHaveBeenCalledWith([
      expect.objectContaining({ effect: Effect.Include }),
    ]);
  });

  it('should remove a filter row when remove button is clicked', () => {
    render(
      <NotificationFiltersEditor
        selectedResources={['table']}
        supportedFilters={mockSupportedFilters}
        value={[{ effect: Effect.Include, name: 'filterA' } as EventFilterRule]}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByTestId('remove-filter-0'));

    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('should hide add and remove buttons in view mode', () => {
    render(
      <NotificationFiltersEditor
        isViewMode
        selectedResources={['table']}
        supportedFilters={mockSupportedFilters}
        value={[{ effect: Effect.Include, name: 'filterA' } as EventFilterRule]}
        onChange={mockOnChange}
      />
    );

    expect(screen.queryByTestId('add-filters')).not.toBeInTheDocument();
    expect(screen.queryByTestId('remove-filter-0')).not.toBeInTheDocument();
  });
});
