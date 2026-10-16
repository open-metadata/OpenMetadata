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
import ActivityFeedTasks from './ActivityFeedTasks';

const SCOPE = { type: 'entity' as const, aboutEntity: 'svc.db.schema.orders' };
const mockUseTaskQueue = jest.fn();
const mockQueue = {
  status: 'open',
  statusCounts: { all: 4, open: 3, closed: 1 },
  handleStatusChange: jest.fn(),
  search: '',
  handleSearchChange: jest.fn(),
  handleClearFilters: jest.fn(),
  grouping: 'type',
  setGrouping: jest.fn(),
  typeFilter: [],
  setTypeFilter: jest.fn(),
  tasks: [],
  visibleTasks: [],
  showEmptyState: false,
};

jest.mock('../../discovery/personal-space/InboxPage/useTaskQueue', () => ({
  ...jest.requireActual(
    '../../discovery/personal-space/InboxPage/useTaskQueue'
  ),
  useTaskQueue: (...args: unknown[]) => {
    mockUseTaskQueue(...args);

    return mockQueue;
  },
}));

jest.mock(
  '../../discovery/personal-space/InboxPage/components/InboxTaskListToolbar',
  () => ({ useTaskTypeOptions: () => [] })
);

// The panes have their own suite; here they only render the list's controls.
jest.mock(
  '../../discovery/personal-space/InboxPage/components/TaskQueueBody',
  () => ({
    __esModule: true,
    default: ({ toolbar }: { toolbar: ReactNode }) => <div>{toolbar}</div>,
    TaskQueueEmptyState: () => null,
  })
);

jest.mock(
  '../../discovery/personal-space/InboxPage/components/ActivityToolbarMenu',
  () => ({
    __esModule: true,
    default: ({
      options,
      triggerLabel,
      onChange,
      ...props
    }: {
      options: { value: string; label: string }[];
      triggerLabel?: string;
      onChange: (value: string) => void;
      'data-testid': string;
    }) => (
      <div data-testid={props['data-testid']}>
        <span data-testid={`${props['data-testid']}-trigger`}>
          {triggerLabel}
        </span>
        {options.map(({ value, label }) => (
          <button key={value} onClick={() => onChange(value)}>
            {label}
          </button>
        ))}
      </div>
    ),
  })
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  FilterSelect: () => <div data-testid="type-filter" />,
  Input: ({
    inputDataTestId,
    onChange,
  }: {
    inputDataTestId: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label="search"
      data-testid={inputDataTestId}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  SearchInputIcon: () => null,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key === 'label.value-with-count' && options
        ? `${options.value} · ${options.count}`
        : key,
  }),
}));

describe('ActivityFeedTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("queues the scope's tasks beside the host's control", () => {
    const onTaskChange = jest.fn();
    render(
      <ActivityFeedTasks
        leading={<span data-testid="host-switch" />}
        scope={SCOPE}
        onTaskChange={onTaskChange}
      />
    );

    expect(mockUseTaskQueue).toHaveBeenCalledWith({
      scope: SCOPE,
      onTaskChange,
    });
    expect(screen.getByTestId('host-switch')).toBeInTheDocument();
  });

  it('reads the status with its count and changes it', () => {
    render(<ActivityFeedTasks scope={SCOPE} />);

    expect(
      screen.getByTestId('activity-feed-task-status-trigger')
    ).toHaveTextContent('label.open · 3');

    fireEvent.click(screen.getByText('label.closed'));

    expect(mockQueue.handleStatusChange).toHaveBeenCalledWith('closed');
  });

  it('searches and regroups the queue', () => {
    render(<ActivityFeedTasks scope={SCOPE} />);

    fireEvent.change(screen.getByTestId('activity-feed-task-search'), {
      target: { value: 'refunds' },
    });
    fireEvent.click(screen.getByText('label.none'));

    expect(mockQueue.handleSearchChange).toHaveBeenCalledWith('refunds');
    expect(mockQueue.setGrouping).toHaveBeenCalledWith('none');
  });
});
