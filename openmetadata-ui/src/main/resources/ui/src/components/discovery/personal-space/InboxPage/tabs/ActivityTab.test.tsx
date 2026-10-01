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
import { PropsWithChildren, ReactNode } from 'react';

interface MockItem {
  id: string;
  eventType?: string;
  timestamp?: number;
  actor?: { id: string; name: string; displayName?: string };
}

interface MockInboxItem {
  activity?: MockItem;
  feed?: MockItem;
}

let activityState: {
  items: MockInboxItem[];
  total: number;
  isLoading: boolean;
};
const mockRefetch = jest.fn();
const mockUseInboxActivity = jest.fn();

jest.mock('../useInboxActivity', () => ({
  getInboxItemTimestamp: (item: MockInboxItem) => item.activity?.timestamp ?? 0,
  useInboxActivity: (...args: unknown[]) => {
    mockUseInboxActivity(...args);

    return {
      items: activityState.items,
      total: activityState.total,
      isLoading: activityState.isLoading,
      refetch: mockRefetch,
    };
  },
}));

// Exercised by its own suite; here it only drives the tab's state.
jest.mock('../components/ActivityToolbar', () => ({
  __esModule: true,
  default: ({
    onFilterChange,
    onGroupingChange,
    onTypeKeysChange,
  }: {
    onFilterChange: (value: string) => void;
    onGroupingChange: (value: string) => void;
    onTypeKeysChange: (value: string[]) => void;
  }) => (
    <div>
      <button onClick={() => onFilterChange('following')}>following</button>
      <button onClick={() => onGroupingChange('user')}>by-user</button>
      <button onClick={() => onTypeKeysChange(['label.tag-plural'])}>
        tags-only
      </button>
    </div>
  ),
}));

jest.mock('../components/InboxFilterBar', () => ({
  __esModule: true,
  default: () => <div data-testid="inbox-filter-bar" />,
}));

jest.mock('../components/ActivityFeedItem', () => ({
  __esModule: true,
  default: ({
    activity,
    feed,
    timeFormat,
    onClick,
  }: {
    activity?: MockItem;
    feed?: MockItem;
    timeFormat?: string;
    onClick: (selection: { activity?: MockItem; feed?: MockItem }) => void;
  }) => (
    <button
      data-testid="feed-item"
      data-time-format={timeFormat}
      onClick={() => onClick(activity ? { activity } : { feed })}>
      {activity?.id ?? feed?.id}
    </button>
  ),
}));

jest.mock('../components/ActivityDetailDrawer', () => ({
  __esModule: true,
  default: ({
    open,
    activity,
    feed,
  }: {
    open: boolean;
    activity?: MockItem;
    feed?: MockItem;
  }) =>
    open ? <div data-testid="drawer">{activity?.id ?? feed?.id}</div> : null,
}));

jest.mock('../components/ActivitySkeleton', () => ({
  __esModule: true,
  default: () => <div data-testid="activity-skeleton" />,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    ...props
  }: PropsWithChildren<{ 'data-testid'?: string }>) => (
    <div data-testid={props['data-testid']}>{children}</div>
  ),
  Typography: ({ children }: PropsWithChildren) => <span>{children}</span>,
  EmptyPlaceholder: ({
    title,
    description,
    ...props
  }: {
    title?: ReactNode;
    description?: ReactNode;
    'data-testid'?: string;
  }) => (
    <div data-testid={props['data-testid']}>
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import ActivityTab from './ActivityTab';

describe('ActivityTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activityState = {
      items: [],
      total: 0,
      isLoading: false,
    };
  });

  it('shows the first-run empty state when there is nothing', () => {
    render(<ActivityTab />);

    expect(
      screen.getByText('label.activity-feed-starts-here')
    ).toBeInTheDocument();
  });

  it('shows the no-results empty state when filtered', () => {
    render(<ActivityTab isFiltered />);

    expect(screen.getByText('label.no-activity-in-period')).toBeInTheDocument();
  });

  it('shows the skeleton while loading', () => {
    activityState = { ...activityState, isLoading: true };
    render(<ActivityTab />);

    expect(screen.getByTestId('activity-skeleton')).toBeInTheDocument();
  });

  it('reports the total via onCountChange', () => {
    activityState = {
      items: [{ activity: { id: 'a1' } }],
      total: 7,
      isLoading: false,
    };
    const onCountChange = jest.fn();

    render(<ActivityTab onCountChange={onCountChange} />);

    expect(onCountChange).toHaveBeenCalledWith(7);
  });

  it('renders activity events and conversations in one merged list', () => {
    activityState = {
      items: [
        { activity: { id: 'a1' } },
        { feed: { id: 't1' } },
        { activity: { id: 'a2' } },
      ],
      total: 3,
      isLoading: false,
    };

    render(<ActivityTab />);

    // Both kinds render, in the hook's (timestamp-merged) order.
    expect(
      screen.getAllByTestId('feed-item').map((el) => el.textContent)
    ).toEqual(['a1', 't1', 'a2']);
  });

  it('renders conversations alone when there are no activity events', () => {
    activityState = {
      items: [{ feed: { id: 't1' } }],
      total: 1,
      isLoading: false,
    };

    render(<ActivityTab />);

    expect(screen.getByText('t1')).toBeInTheDocument();
  });

  it('opens the detail drawer when an item is clicked', () => {
    activityState = {
      items: [{ activity: { id: 'a1' } }],
      total: 1,
      isLoading: false,
    };

    render(<ActivityTab />);
    fireEvent.click(screen.getByTestId('feed-item'));

    expect(screen.getByTestId('drawer')).toHaveTextContent('a1');
  });

  it('fetches the sub-tab the toolbar selects', () => {
    render(<ActivityTab />);

    expect(mockUseInboxActivity).toHaveBeenLastCalledWith('all', undefined);

    fireEvent.click(screen.getByText('following'));

    expect(mockUseInboxActivity).toHaveBeenLastCalledWith(
      'following',
      undefined
    );
  });

  it('keeps only the chosen types', () => {
    activityState = {
      items: [
        { activity: { id: 'tags', eventType: 'TagsUpdated' } },
        { activity: { id: 'created', eventType: 'EntityCreated' } },
      ],
      total: 2,
      isLoading: false,
    };

    render(<ActivityTab />);
    fireEvent.click(screen.getByText('tags-only'));

    expect(
      screen.getAllByTestId('feed-item').map((el) => el.textContent)
    ).toEqual(['tags']);
  });

  it('heads each day with its date and shows clock times beneath it', () => {
    activityState = {
      items: [{ activity: { id: 'a1', timestamp: 1 } }],
      total: 1,
      isLoading: false,
    };

    render(<ActivityTab />);

    expect(screen.getAllByTestId('activity-group')).toHaveLength(1);
    expect(screen.getByText('label.one-update')).toBeInTheDocument();
    expect(screen.getByTestId('feed-item')).toHaveAttribute(
      'data-time-format',
      'hh:mm a'
    );
  });

  it('groups by the person who acted, with full dates on the cards', () => {
    const alice = { id: 'u1', name: 'alice', displayName: 'Alice' };
    activityState = {
      items: [
        { activity: { id: 'a1', actor: alice } },
        { activity: { id: 'b1', actor: { id: 'u2', name: 'bob' } } },
        { activity: { id: 'a2', actor: alice } },
      ],
      total: 3,
      isLoading: false,
    };

    render(<ActivityTab />);
    fireEvent.click(screen.getByText('by-user'));

    const groups = screen.getAllByTestId('activity-group');

    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('Alice');
    expect(groups[0]).toHaveTextContent('a1a2');
    expect(screen.getAllByTestId('feed-item')[0]).toHaveAttribute(
      'data-time-format',
      'MMM dd, yyyy, hh:mm a'
    );
  });
});
