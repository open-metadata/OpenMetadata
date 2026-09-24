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

interface MockFilterSelectProps {
  label: string;
  options: {
    value: string;
    label: ReactNode;
    count?: number;
    textValue?: string;
  }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  'data-testid'?: string;
}

// The real control is a popover-driven listbox with its own suite; here each
// option is a button so a test can pick one.
jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    ...rest
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={rest['data-testid']}>{children}</div>,
  FilterSelect: ({
    options,
    selectedValues,
    onChange,
    'data-testid': testId,
  }: MockFilterSelectProps) => (
    <div data-selected={selectedValues.join(',')} data-testid={testId}>
      {options.map((option) => (
        <button
          data-count={option.count}
          data-testid={`${testId}-${option.value}`}
          data-text={option.textValue}
          key={option.value}
          onClick={() => onChange([option.value])}>
          {option.label}
        </button>
      ))}
    </div>
  ),
  Input: ({
    value,
    onChange,
    inputDataTestId,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    inputDataTestId?: string;
  }) => (
    <input
      aria-label="search"
      data-testid={inputDataTestId}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
  SearchInputIcon: () => <span />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { value?: string }) =>
      options?.value ? `${key}:${options.value}` : key,
  }),
}));

import { Task, TaskType } from '../../../../../generated/entity/tasks/task';
import InboxTaskListToolbar from './InboxTaskListToolbar';

const TASKS = [
  { id: 't1', type: TaskType.TagUpdate },
  { id: 't2', type: TaskType.TagUpdate },
  { id: 't3', type: TaskType.TestCaseResolution },
] as unknown as Task[];

const props = {
  statusFilter: <div data-testid="status-filter" />,
  search: '',
  onSearchChange: jest.fn(),
  grouping: 'type' as const,
  onGroupingChange: jest.fn(),
  typeFilter: [],
  onTypeFilterChange: jest.fn(),
  tasks: TASKS,
};

beforeEach(() => jest.clearAllMocks());

describe('InboxTaskListToolbar', () => {
  it('reports what was typed in the search box', () => {
    render(<InboxTaskListToolbar {...props} />);

    fireEvent.change(screen.getByTestId('inbox-tasks-search'), {
      target: { value: 'customer' },
    });

    expect(props.onSearchChange).toHaveBeenCalledWith('customer');
  });

  // Offering the full enum would list types the queue does not contain.
  it('offers only the types present in the queue, with their counts', () => {
    render(<InboxTaskListToolbar {...props} />);

    expect(
      screen.getByTestId('inbox-tasks-type-filter-TagUpdate')
    ).toHaveAttribute('data-count', '2');
    expect(
      screen.getByTestId('inbox-tasks-type-filter-TestCaseResolution')
    ).toHaveAttribute('data-count', '1');
    expect(
      screen.queryByTestId('inbox-tasks-type-filter-DataAccessRequest')
    ).not.toBeInTheDocument();
  });

  it('reports a chosen type', () => {
    render(<InboxTaskListToolbar {...props} />);

    fireEvent.click(screen.getByTestId('inbox-tasks-type-filter-TagUpdate'));

    expect(props.onTypeFilterChange).toHaveBeenCalledWith([TaskType.TagUpdate]);
  });

  it('reports a grouping change', () => {
    render(<InboxTaskListToolbar {...props} />);

    fireEvent.click(screen.getByTestId('inbox-tasks-group-by-none'));

    expect(props.onGroupingChange).toHaveBeenCalledWith('none');
  });

  it('shows the active grouping as selected', () => {
    render(<InboxTaskListToolbar {...props} />);

    expect(screen.getByTestId('inbox-tasks-group-by')).toHaveAttribute(
      'data-selected',
      'type'
    );
  });

  it('heads the list with the status control', () => {
    render(<InboxTaskListToolbar {...props} />);

    expect(screen.getByTestId('status-filter')).toBeInTheDocument();
  });

  // The trigger reads "Group: Type" while the menu rows stay bare.
  it('names the grouping on the trigger', () => {
    render(<InboxTaskListToolbar {...props} />);

    expect(screen.getByTestId('inbox-tasks-group-by-type')).toHaveAttribute(
      'data-text',
      'label.group-with-value:label.type'
    );
  });

  it('offers no types for an empty queue', () => {
    render(<InboxTaskListToolbar {...props} tasks={[]} />);

    expect(screen.getByTestId('inbox-tasks-type-filter')).toBeEmptyDOMElement();
  });
});
