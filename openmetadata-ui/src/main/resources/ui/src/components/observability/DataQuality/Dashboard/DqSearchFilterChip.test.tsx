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
import type { FilterSelectProps } from '@openmetadata/ui-core-components';
import DqSearchFilterChip from './DqSearchFilterChip';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@openmetadata/ui-core-components', () => ({
  FilterSelect: ({
    'data-testid': testId,
    label,
    options,
    selectedValues,
    commitMode,
    isOpen,
    resolveMissingLabel,
    onChange,
    onSearch,
    onOpenChange,
  }: FilterSelectProps) => (
    <div data-isopen={isOpen ? 'true' : 'false'} data-testid={testId}>
      <span data-testid="trigger-label">
        {selectedValues.length > 0
          ? `${label} · ${selectedValues.length}`
          : label}
      </span>
      <span data-testid="commit-mode">{commitMode}</span>
      {options.map((option, index) => (
        <div data-testid={`option-${index}`} key={option.value}>
          {option.label}
        </div>
      ))}
      {selectedValues.map((value) => (
        <div data-testid={`selected-${value}`} key={value}>
          {resolveMissingLabel?.(value) ?? value}
        </div>
      ))}
      <button data-testid="open-btn" onClick={() => onOpenChange?.(true)}>
        open
      </button>
      <button
        data-testid="commit-opt-1"
        onClick={() => onChange(['opt-1'])}>
        commit opt-1
      </button>
      <button data-testid="commit-empty" onClick={() => onChange([])}>
        commit empty
      </button>
      <button data-testid="search-btn" onClick={() => onSearch?.('abc')}>
        search
      </button>
    </div>
  ),
}));

const buildSearchProps = (overrides: Record<string, any> = {}) => ({
  options: [{ key: 'opt-1', label: 'Option 1' }],
  selectedKeys: [],
  onChange: jest.fn(),
  onGetInitialOptions: jest.fn(),
  onSearch: jest.fn(),
  ...overrides,
});

const getDefaultProps = (searchOverrides: Record<string, any> = {}) => ({
  label: 'Tags',
  searchKey: 'tags',
  searchProps: buildSearchProps(searchOverrides),
  isOpen: false,
  onOpenChange: jest.fn(),
});

describe('DqSearchFilterChip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the trigger with the plain label when nothing is selected', () => {
    render(<DqSearchFilterChip {...(getDefaultProps() as any)} />);

    expect(screen.getByTestId('trigger-label')).toHaveTextContent('Tags');
  });

  it('should render the selection count in the trigger label', () => {
    const props = getDefaultProps({
      selectedKeys: [{ key: 'opt-1', label: 'Option 1' }],
    });
    render(<DqSearchFilterChip {...(props as any)} />);

    expect(screen.getByTestId('trigger-label')).toHaveTextContent('Tags · 1');
  });

  it('should stage selections instead of committing per click', () => {
    render(<DqSearchFilterChip {...(getDefaultProps() as any)} />);

    expect(screen.getByTestId('commit-mode')).toHaveTextContent('staged');
  });

  it('should resolve a persisted selection missing from the fetched options', () => {
    const props = getDefaultProps({
      selectedKeys: [{ key: 'persisted', label: 'Persisted Tag' }],
      options: [{ key: 'opt-1', label: 'Option 1' }],
    });
    render(<DqSearchFilterChip {...(props as any)} />);

    expect(screen.getByTestId('selected-persisted')).toHaveTextContent(
      'Persisted Tag'
    );
  });

  it('should fetch initial options and forward open state when opened', () => {
    const props = getDefaultProps();
    render(<DqSearchFilterChip {...(props as any)} />);

    fireEvent.click(screen.getByTestId('open-btn'));

    expect(props.searchProps.onGetInitialOptions).toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(true);
  });

  it('should map committed values back to their option objects', () => {
    const props = getDefaultProps();
    render(<DqSearchFilterChip {...(props as any)} />);

    fireEvent.click(screen.getByTestId('commit-opt-1'));

    expect(props.searchProps.onChange).toHaveBeenCalledWith([
      { key: 'opt-1', label: 'Option 1' },
    ]);
  });

  it('should commit an empty selection as an empty list', () => {
    const props = getDefaultProps();
    render(<DqSearchFilterChip {...(props as any)} />);

    fireEvent.click(screen.getByTestId('commit-empty'));

    expect(props.searchProps.onChange).toHaveBeenCalledWith([]);
  });

  it('should forward the typed query to onSearch', () => {
    const props = getDefaultProps();
    render(<DqSearchFilterChip {...(props as any)} />);

    fireEvent.click(screen.getByTestId('search-btn'));

    expect(props.searchProps.onSearch).toHaveBeenCalledWith('abc');
  });
});
