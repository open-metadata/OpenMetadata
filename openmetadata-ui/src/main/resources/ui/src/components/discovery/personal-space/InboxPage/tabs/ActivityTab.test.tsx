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
  entity?: { id: string; type: string; name: string };
}

interface MockInboxItem {
  activity?: MockItem;
  feed?: MockItem;
}

let activityState: {
  items: MockInboxItem[];
  total: number;
  isLoading: boolean;
  error?: unknown;
};
const mockRefetch = jest.fn();
const mockUseInboxActivity = jest.fn();
// What the Mentions feed returns, read separately to mark mentioned cards.
let mockMentionItems: MockInboxItem[] = [];

jest.mock('../useInboxActivity', () => ({
  getInboxItemId: (item: MockInboxItem) =>
    String(item.activity?.id ?? item.feed?.id ?? ''),
  getInboxItemTimestamp: (item: MockInboxItem) => item.activity?.timestamp ?? 0,
  useInboxActivity: (filter: string, ...args: unknown[]) => {
    if (filter === 'mentions') {
      return { items: mockMentionItems, total: 0, isLoading: false };
    }
    mockUseInboxActivity(filter, ...args);

    return {
      items: activityState.items,
      total: activityState.total,
      isLoading: activityState.isLoading,
      error: activityState.error ?? null,
      refetch: mockRefetch,
    };
  },
  useInboxActivityCounts: () => ({}),
}));

// Exercised by its own suite; here it only drives the tab's state.
jest.mock('../components/ActivityToolbar', () => ({
  __esModule: true,
  default: ({
    datePreset,
    onDatePresetChange,
    onFilterChange,
    onGroupingChange,
    onTypeKeysChange,
  }: {
    datePreset: string;
    onDatePresetChange: (key: string) => void;
    onFilterChange: (value: string) => void;
    onGroupingChange: (value: string) => void;
    onTypeKeysChange: (value: string[]) => void;
  }) => (
    <div data-preset={datePreset} data-testid="toolbar">
      <button onClick={() => onDatePresetChange('last7days')}>
        last-7-days
      </button>
      <button onClick={() => onFilterChange('following')}>following</button>
      <button onClick={() => onGroupingChange('user')}>by-user</button>
      <button onClick={() => onGroupingChange('asset')}>by-asset</button>
      <button onClick={() => onTypeKeysChange(['label.tag-plural'])}>
        tags-only
      </button>
    </div>
  ),
}));

jest.mock('../components/ActivityFeedItem', () => ({
  __esModule: true,
  default: ({
    activity,
    feed,
    isMentioned,
    mentionedName,
    timeFormat,
  }: {
    activity?: MockItem;
    feed?: MockItem;
    isMentioned?: boolean;
    mentionedName?: string;
    timeFormat?: string;
  }) => (
    <div
      data-mentioned={isMentioned}
      data-mentioned-name={mentionedName}
      data-testid="feed-item"
      data-time-format={timeFormat}>
      {activity?.id ?? feed?.id}
    </div>
  ),
}));

jest.mock(
  '../../../../../components/common/ProfilePicture/ProfilePicture',
  () => ({
    __esModule: true,
    default: ({ name }: { name: string }) => (
      <span data-testid={`group-avatar-${name}`} />
    ),
  })
);

jest.mock('../../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityIcon: (type: string) => (
      <span data-testid={`group-icon-${type}`} />
    ),
  },
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
    actions,
    ...props
  }: {
    title?: ReactNode;
    description?: ReactNode;
    actions?: { key: string; label: ReactNode; onPress?: () => void }[];
    'data-testid'?: string;
  }) => (
    <div data-testid={props['data-testid']}>
      <span>{title}</span>
      <span>{description}</span>
      {actions?.map(({ key, label, onPress }) => (
        <button key={key} onClick={onPress}>
          {label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { number?: number }) =>
      options?.number === undefined ? key : `${key}:${options.number}`,
  }),
}));

import { User } from '../../../../../generated/entity/teams/user';
import { getInboxDateRange } from '../inbox.utils';
import ActivityTab from './ActivityTab';

const alice = {
  id: 'alice-id',
  name: 'alice.johnson',
  displayName: 'Alice Johnson',
} as User;

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

  // A failed feed must not read as an empty one.
  it('shows an error with a retry, not the empty state, when the feed fails', () => {
    activityState = { ...activityState, error: { response: { status: 500 } } };
    render(<ActivityTab />);

    expect(
      screen.getByText('message.something-went-wrong')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('label.activity-feed-starts-here')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.reload' }));

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('shows a permission placeholder when the feed is forbidden', () => {
    activityState = { ...activityState, error: { response: { status: 403 } } };
    render(<ActivityTab />);

    expect(screen.getByText('label.access-denied')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.reload' })
    ).not.toBeInTheDocument();
  });

  it('shows the skeleton while loading', () => {
    activityState = { ...activityState, isLoading: true };
    render(<ActivityTab />);

    expect(screen.getByTestId('activity-skeleton')).toBeInTheDocument();
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

  it('marks the cards the Mentions feed names', () => {
    activityState = {
      items: [{ activity: { id: 'a1' } }, { feed: { id: 't1' } }],
      total: 2,
      isLoading: false,
    };
    mockMentionItems = [{ feed: { id: 't1' } }];

    render(<ActivityTab />);

    expect(
      screen
        .getAllByTestId('feed-item')
        .map((el) => el.getAttribute('data-mentioned'))
    ).toEqual(['false', 'true']);
  });

  it('fetches the sub-tab the toolbar selects', () => {
    render(<ActivityTab />);

    // Uncontrolled, the tab keeps its own window at the default preset.
    const defaultWindow = expect.objectContaining({ key: 'last30days' });

    expect(mockUseInboxActivity).toHaveBeenLastCalledWith(
      'all',
      defaultWindow,
      undefined
    );

    fireEvent.click(screen.getByText('following'));

    expect(mockUseInboxActivity).toHaveBeenLastCalledWith(
      'following',
      defaultWindow,
      undefined
    );
  });

  // Without a window from the parent, the tab keeps and narrows its own.
  it('narrows its own window when a preset is picked without a parent window', () => {
    render(<ActivityTab />);
    fireEvent.click(screen.getByText('last-7-days'));

    expect(mockUseInboxActivity).toHaveBeenLastCalledWith(
      'all',
      { ...getInboxDateRange(7), key: 'last7days' },
      undefined
    );
    expect(screen.getByTestId('toolbar')).toHaveAttribute(
      'data-preset',
      'last7days'
    );
    // A narrowed window empties to "no activity in period", not first-run.
    expect(screen.getByText('label.no-activity-in-period')).toBeInTheDocument();
  });

  it("uses the parent's window and hands it the preset when given one", () => {
    const dateRange = { startTs: 100, endTs: 200, key: 'last30days' };
    const onDatePresetChange = jest.fn();

    render(
      <ActivityTab
        dateRange={dateRange}
        onDatePresetChange={onDatePresetChange}
      />
    );
    fireEvent.click(screen.getByText('last-7-days'));

    expect(onDatePresetChange).toHaveBeenCalledWith('last7days');
    expect(mockUseInboxActivity).toHaveBeenLastCalledWith(
      'all',
      dateRange,
      undefined
    );
    expect(
      screen.getByText('label.activity-feed-starts-here')
    ).toBeInTheDocument();
  });

  it("fetches another user's feeds when given a user", () => {
    render(<ActivityTab user={alice} />);

    expect(mockUseInboxActivity).toHaveBeenLastCalledWith(
      'all',
      expect.anything(),
      'alice-id'
    );
  });

  it('names the viewed user, not "you", on mentions and the empty state', () => {
    render(<ActivityTab user={alice} />);

    expect(screen.getByText('label.no-activity-yet')).toBeInTheDocument();
    expect(
      screen.getByText('message.user-activity-empty-description')
    ).toBeInTheDocument();

    activityState = {
      items: [{ feed: { id: 't1' } }],
      total: 1,
      isLoading: false,
    };
    mockMentionItems = [{ feed: { id: 't1' } }];
    render(<ActivityTab user={alice} />);

    expect(screen.getByTestId('feed-item')).toHaveAttribute(
      'data-mentioned-name',
      'Alice'
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

  // Cards render a batch at a time; the header still counts the whole day.
  it('counts the whole group in its header, not the rendered batch', () => {
    activityState = {
      items: Array.from({ length: 45 }, (_, index) => ({
        activity: { id: `a${index}`, timestamp: 1 },
      })),
      total: 45,
      isLoading: false,
    };

    render(<ActivityTab />);

    expect(screen.getAllByTestId('feed-item')).toHaveLength(40);
    expect(screen.getByTestId('activity-group')).toHaveTextContent(
      'label.number-update-plural:45'
    );
  });

  // A batch revealed later would grow a group above the viewport, so Asset and
  // User groupings render every card at once.
  it('renders every card when grouped by user, not a batch', () => {
    const alice = { id: 'u1', name: 'alice' };
    activityState = {
      items: Array.from({ length: 45 }, (_, index) => ({
        activity: { id: `a${index}`, actor: alice },
      })),
      total: 45,
      isLoading: false,
    };

    render(<ActivityTab />);
    fireEvent.click(screen.getByText('by-user'));

    expect(screen.getAllByTestId('feed-item')).toHaveLength(45);
    expect(screen.queryByTestId('inbox-activity-sentinel')).toBeNull();
    expect(screen.getByTestId('activity-group')).toHaveTextContent(
      'label.number-update-plural:45'
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

  // A User group leads with the person, an Asset group with the asset's icon;
  // a day needs neither.
  it("marks a User group with the person and an Asset group with the asset's icon", () => {
    const table = { id: 't1', type: 'table', name: 'orders' };
    activityState = {
      items: [
        {
          activity: {
            id: 'a1',
            timestamp: 1,
            actor: { id: 'u1', name: 'alice' },
            entity: table,
          },
        },
      ],
      total: 1,
      isLoading: false,
    };

    render(<ActivityTab />);

    expect(screen.queryByTestId('group-avatar-alice')).toBeNull();
    expect(screen.queryByTestId('group-icon-table')).toBeNull();

    fireEvent.click(screen.getByText('by-user'));

    expect(screen.getByTestId('group-avatar-alice')).toBeInTheDocument();

    fireEvent.click(screen.getByText('by-asset'));

    expect(screen.getByTestId('activity-group')).toHaveTextContent('orders');
    expect(screen.getByTestId('group-icon-table')).toBeInTheDocument();
  });
});
