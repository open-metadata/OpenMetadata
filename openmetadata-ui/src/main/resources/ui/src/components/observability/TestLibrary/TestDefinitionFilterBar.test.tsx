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
import { ReactNode } from 'react';
import TestDefinitionFilterBar from './TestDefinitionFilterBar';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@untitledui/icons', () => ({
  XCircle: () => <span data-testid="icon-x-circle" />,
}));

// Render each option as a button so the item list can be asserted and a
// selection driven without standing up the real listbox.
jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: (...args: never[]) => void;
  }) => (
    <button data-testid="clear-all" onClick={onPress}>
      {children}
    </button>
  ),
  Select: ({ items, label, value, onChange }: any) => (
    <div data-testid={`select-${label}`}>
      <span data-testid={`value-${label}`}>{String(value)}</span>
      {items.map((item: any) => (
        <button
          data-testid={`${label}-option-${item.id}`}
          key={item.id}
          onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('constants/TestDefinition.constants', () => ({
  TEST_DEFINITION_FILTERS: [
    {
      label: 'entityType',
      key: 'entityType',
      options: [
        { key: 'TABLE', label: 'Table' },
        { key: 'COLUMN', label: 'Column' },
      ],
    },
  ],
}));

const renderBar = (props: Partial<Record<string, any>> = {}) => {
  const onFilterChange = jest.fn();
  const onClearAll = jest.fn();

  render(
    <TestDefinitionFilterBar
      filterValues={{}}
      hasActiveFilters={false}
      onClearAll={onClearAll}
      onFilterChange={onFilterChange}
      {...(props as any)}
    />
  );

  return { onFilterChange, onClearAll };
};

describe('TestDefinitionFilterBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should offer the concrete options alongside an All entry', () => {
    renderBar();

    expect(screen.getByTestId('entityType-option-TABLE')).toBeInTheDocument();
    expect(screen.getByTestId('entityType-option-COLUMN')).toBeInTheDocument();
    expect(screen.getByTestId('entityType-option-__all__')).toHaveTextContent(
      'label.all'
    );
  });

  // The Select renders `label.all` only as a placeholder, so without a real
  // entry the option vanishes the moment a value is picked and the filter can
  // never be returned to unfiltered from the dropdown.
  it('should keep the All entry available once a filter has a value', () => {
    renderBar({
      filterValues: { entityType: ['TABLE'] },
      hasActiveFilters: true,
    });

    expect(screen.getByTestId('value-entityType')).toHaveTextContent('TABLE');
    expect(screen.getByTestId('entityType-option-__all__')).toBeInTheDocument();
  });

  it('should clear the filter when All is picked', () => {
    const { onFilterChange } = renderBar({
      filterValues: { entityType: ['TABLE'] },
      hasActiveFilters: true,
    });

    fireEvent.click(screen.getByTestId('entityType-option-__all__'));

    expect(onFilterChange).toHaveBeenCalledWith('entityType', undefined);
  });

  it('should forward a concrete option as the filter value', () => {
    const { onFilterChange } = renderBar();

    fireEvent.click(screen.getByTestId('entityType-option-COLUMN'));

    expect(onFilterChange).toHaveBeenCalledWith('entityType', 'COLUMN');
  });
});
