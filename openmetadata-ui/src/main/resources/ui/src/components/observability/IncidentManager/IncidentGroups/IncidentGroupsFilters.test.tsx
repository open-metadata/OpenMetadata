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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { getUserAndTeamSearch } from '../../../../rest/miscAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { IncidentGroupFilters } from './IncidentGroups.types';
import IncidentGroupsFilters from './IncidentGroupsFilters';

const mockSearchQuery = searchQuery as jest.Mock;
const mockGetUserAndTeamSearch = getUserAndTeamSearch as jest.Mock;
const mockOnChange = jest.fn();

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../../rest/miscAPI', () => ({
  getUserAndTeamSearch: jest.fn(),
}));

interface MockFilterSelectProps {
  label: string;
  options: { value: string; label: ReactNode }[];
  selectedValues: string[];
  'data-testid': string;
  resolveMissingLabel?: (value: string) => ReactNode;
  onChange: (values: string[]) => void;
  onOpenChange?: (open: boolean) => void;
  onSearch?: (text: string) => void;
}

// The core select is driven through its props: what this component owns is
// the mapping between those props and the filter set, not the menu itself.
jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  FilterSelect: jest
    .fn()
    .mockImplementation(
      ({
        label,
        options,
        selectedValues,
        'data-testid': testId,
        resolveMissingLabel,
        onChange,
        onOpenChange,
        onSearch,
      }: MockFilterSelectProps) => (
        <div aria-label={label} data-testid={testId}>
          <span data-testid={`${testId}-selected`}>
            {selectedValues.join(',')}
          </span>
          <span data-testid={`${testId}-selected-label`}>
            {selectedValues.map((value) => resolveMissingLabel?.(value))}
          </span>
          <button
            aria-label={`${testId}-open`}
            data-testid={`${testId}-open`}
            onClick={() => onOpenChange?.(true)}
          />
          <button
            aria-label={`${testId}-close`}
            data-testid={`${testId}-close`}
            onClick={() => onOpenChange?.(false)}
          />
          <button
            aria-label={`${testId}-search`}
            data-testid={`${testId}-search`}
            onClick={() => onSearch?.('query')}
          />
          <button
            aria-label={`${testId}-search-empty`}
            data-testid={`${testId}-search-empty`}
            onClick={() => onSearch?.('')}
          />
          <button
            aria-label={`${testId}-clear`}
            data-testid={`${testId}-clear`}
            onClick={() => onChange([])}
          />
          {options.map((option) => (
            <button
              data-testid={`${testId}-option-${option.value}`}
              key={option.value}
              onClick={() => onChange([...selectedValues, option.value])}>
              {option.label}
            </button>
          ))}
        </div>
      )
    ),
}));

jest.mock('../../DataQuality/Dashboard/DqDateRangeFilter', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(
      ({
        startTs,
        endTs,
        onApply,
      }: {
        startTs?: number;
        endTs?: number;
        onApply: (range: { startTs: number; endTs: number }) => void;
      }) => (
        <div data-testid="date-range-filter">
          <span data-testid="date-range-value">{`${startTs}-${endTs}`}</span>
          <button
            aria-label="date-range-apply"
            data-testid="date-range-apply"
            onClick={() => onApply({ startTs: 1, endTs: 2 })}
          />
        </div>
      )
    ),
}));

const NO_FILTERS: IncidentGroupFilters = {
  status: [],
  dateField: 'timestamp',
};

const renderFilters = (filters: Partial<IncidentGroupFilters> = {}) =>
  render(
    <IncidentGroupsFilters
      filters={{ ...NO_FILTERS, ...filters }}
      onChange={mockOnChange}
    />
  );

describe('IncidentGroupsFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              name: 'row_count',
              displayName: 'Row count',
              fullyQualifiedName: 'svc.db.schema.orders.row_count',
            },
          },
        ],
      },
    });
    mockGetUserAndTeamSearch.mockResolvedValue({
      data: {
        hits: {
          hits: [
            {
              _source: {
                name: 'aaron',
                displayName: 'Aaron Johnson',
                entityType: 'user',
              },
            },
          ],
        },
      },
    });
  });

  it('should caption every filter of the design', () => {
    renderFilters();

    expect(screen.getByTestId('incident-groups-test-case')).toHaveAttribute(
      'aria-label',
      'label.test-case'
    );

    expect(screen.getByText('label.test-case')).toBeInTheDocument();
    expect(screen.getByText('label.assignee')).toBeInTheDocument();
    expect(screen.getByText('label.status')).toBeInTheDocument();
    expect(screen.getByText('label.date-filter')).toBeInTheDocument();
    expect(screen.getByText('label.date-range')).toBeInTheDocument();
  });

  it('should load test cases on open and search them as the user types', async () => {
    renderFilters();

    await act(async () => {
      fireEvent.click(screen.getByTestId('incident-groups-test-case-open'));
    });

    expect(mockSearchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: '*' })
    );
    expect(
      screen.getByTestId(
        'incident-groups-test-case-option-svc.db.schema.orders.row_count'
      )
    ).toHaveTextContent('Row count');

    await act(async () => {
      fireEvent.click(screen.getByTestId('incident-groups-test-case-search'));
    });

    expect(mockSearchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'query' })
    );

    await act(async () => {
      fireEvent.click(
        screen.getByTestId('incident-groups-test-case-search-empty')
      );
    });

    expect(mockSearchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: '*' })
    );
  });

  it('should not search test cases when the menu closes', async () => {
    renderFilters();

    await act(async () => {
      fireEvent.click(screen.getByTestId('incident-groups-test-case-close'));
    });

    expect(mockSearchQuery).not.toHaveBeenCalled();
  });

  it('should filter by the picked test case and clear it again', async () => {
    renderFilters();

    await act(async () => {
      fireEvent.click(screen.getByTestId('incident-groups-test-case-open'));
    });
    fireEvent.click(
      screen.getByTestId(
        'incident-groups-test-case-option-svc.db.schema.orders.row_count'
      )
    );

    expect(mockOnChange).toHaveBeenLastCalledWith({
      testCaseFQN: 'svc.db.schema.orders.row_count',
    });

    fireEvent.click(screen.getByTestId('incident-groups-test-case-clear'));

    expect(mockOnChange).toHaveBeenLastCalledWith({ testCaseFQN: undefined });
  });

  it('should name a test case restored from the URL by its FQN', () => {
    renderFilters({ testCaseFQN: 'svc.db.schema.orders.row_count' });

    expect(
      screen.getByTestId('incident-groups-test-case-selected')
    ).toHaveTextContent('svc.db.schema.orders.row_count');
    expect(
      screen.getByTestId('incident-groups-test-case-selected-label')
    ).toHaveTextContent('row_count');
  });

  it('should search assignees and filter by the picked one', async () => {
    renderFilters();

    await act(async () => {
      fireEvent.click(screen.getByTestId('incident-groups-assignee-open'));
    });

    expect(mockGetUserAndTeamSearch).toHaveBeenLastCalledWith('*', true);

    await act(async () => {
      fireEvent.click(screen.getByTestId('incident-groups-assignee-search'));
    });

    expect(mockGetUserAndTeamSearch).toHaveBeenLastCalledWith('query', true);

    await act(async () => {
      fireEvent.click(
        screen.getByTestId('incident-groups-assignee-search-empty')
      );
    });

    expect(mockGetUserAndTeamSearch).toHaveBeenLastCalledWith('*', true);

    fireEvent.click(
      screen.getByTestId('incident-groups-assignee-option-aaron')
    );

    expect(mockOnChange).toHaveBeenLastCalledWith({ assignee: 'aaron' });
    expect(
      screen.getByTestId('incident-groups-assignee-option-aaron')
    ).toHaveTextContent('Aaron Johnson');
  });

  it('should not search assignees when the menu closes', async () => {
    renderFilters();

    await act(async () => {
      fireEvent.click(screen.getByTestId('incident-groups-assignee-close'));
    });

    expect(mockGetUserAndTeamSearch).not.toHaveBeenCalled();
  });

  it('should show an assignee restored from the URL as selected', () => {
    renderFilters({ assignee: 'aaron' });

    expect(
      screen.getByTestId('incident-groups-assignee-selected')
    ).toHaveTextContent('aaron');
    expect(
      screen.getByTestId('incident-groups-assignee-option-aaron')
    ).toBeInTheDocument();
  });

  it('should offer only the open statuses and add to the selection', () => {
    renderFilters({ status: [TestCaseResolutionStatusTypes.New] });

    expect(
      screen.getByTestId('incident-groups-status-option-New')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('incident-groups-status-option-Ack')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('incident-groups-status-option-Assigned')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('incident-groups-status-option-Resolved')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('incident-groups-status-option-Ack'));

    expect(mockOnChange).toHaveBeenLastCalledWith({
      status: [
        TestCaseResolutionStatusTypes.New,
        TestCaseResolutionStatusTypes.ACK,
      ],
    });
  });

  it('should switch the date field and fall back to the creation date', () => {
    renderFilters();

    expect(
      screen.getByTestId('incident-groups-date-field-selected')
    ).toHaveTextContent('timestamp');
    expect(
      screen.getByTestId('incident-groups-date-field-option-timestamp')
    ).toHaveTextContent('label.created-at');
    expect(
      screen.getByTestId('incident-groups-date-field-option-updatedAt')
    ).toHaveTextContent('label.updated-at');

    fireEvent.click(screen.getByTestId('incident-groups-date-field-clear'));

    expect(mockOnChange).toHaveBeenLastCalledWith({ dateField: 'timestamp' });
  });

  it('should report the applied date range', () => {
    renderFilters({ startTs: 10, endTs: 20 });

    expect(screen.getByTestId('date-range-value')).toHaveTextContent('10-20');

    fireEvent.click(screen.getByTestId('date-range-apply'));

    expect(mockOnChange).toHaveBeenLastCalledWith({ startTs: 1, endTs: 2 });
  });

  it('should offer no clear action while nothing is filtered', () => {
    renderFilters();

    expect(
      screen.queryByTestId('incident-groups-clear-filters')
    ).not.toBeInTheDocument();
  });

  it('should clear every filter at once', () => {
    renderFilters({
      testCaseFQN: 'svc.db.schema.orders.row_count',
      assignee: 'aaron',
      status: [TestCaseResolutionStatusTypes.New],
      dateField: 'updatedAt',
      startTs: 1,
      endTs: 2,
    });

    fireEvent.click(screen.getByTestId('incident-groups-clear-filters'));

    expect(mockOnChange).toHaveBeenLastCalledWith({
      testCaseFQN: undefined,
      assignee: undefined,
      status: [],
      dateField: undefined,
      startTs: undefined,
      endTs: undefined,
    });
  });
});
