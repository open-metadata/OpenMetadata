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

const mockSendReaction = jest.fn();
const mockWriteInboxReactions = jest.fn();
const mockReplyRejected = jest.fn();
const mockShowErrorToast = jest.fn();
const mockGetActivityChange = jest.fn();
const mockCreateThreadReply = jest.fn();
const mockRefetchReplies = jest.fn();
let mockReplies: { id: string; author?: { name: string } }[] = [];

// Cards are on screen in tests, so their replies load straight away.
jest.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: jest.fn(), inView: true }),
}));

jest.mock('../useActivityReplies', () => ({
  createThreadReply: (...args: unknown[]) => mockCreateThreadReply(...args),
  useActivityReplies: (ids: {
    activityId?: string;
    conversationId?: string;
  }) => ({
    threadId: ids.conversationId ?? ids.activityId,
    replies: mockReplies,
    isLoading: false,
    refetch: mockRefetchReplies,
  }),
}));

// Exercised by its own suite; here it reports how it was opened and posts.
// Has its own suite; here it only passes the author through.
jest.mock('./AuthorPopover', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('./ActivityThread', () => ({
  __esModule: true,
  default: ({
    focusComposer,
    onReply,
  }: {
    focusComposer: boolean;
    onReply: (message: string) => Promise<void>;
  }) => (
    // The real composer catches a rejected save to put the draft back.
    <button
      data-focus-composer={String(focusComposer)}
      data-testid="activity-thread"
      onClick={() => onReply('hello').catch(mockReplyRejected)}>
      thread
    </button>
  ),
}));

jest.mock('../inbox.utils', () => ({
  formatActivityTime: () => '12 min ago',
  getActivityChange: (...args: unknown[]) => mockGetActivityChange(...args),
  getActivityEventLabel: () => 'updated description for',
  getActivityTypeKey: () => 'label.other',
  ACTIVITY_TYPE_OTHER: 'label.other',
  ACTIVITY_CLOCK_FORMAT: 'hh:mm a',
  ACTIVITY_DATE_FORMAT: 'MMM dd, yyyy, hh:mm a',
  // The real list logic, so a test sees what a click does to the reactions.
  applyReaction: jest.requireActual('../inbox.utils').applyReaction,
  getFeedSortTimestamp: (feed: { updatedAt?: number; createdAt?: number }) =>
    feed.updatedAt ?? feed.createdAt ?? 0,
  isSameLocalDay: jest.requireActual('../inbox.utils').isSameLocalDay,
  sendReaction: (...args: unknown[]) => mockSendReaction(...args),
}));

jest.mock('../useInboxActivity', () => ({
  writeInboxReactions: (...args: unknown[]) => mockWriteInboxReactions(...args),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => 'query-client',
}));

// Exercised by its own suite; here it only shows which change it was given.
jest.mock('./ActivityChangePanel', () => ({
  __esModule: true,
  default: ({ change }: { change: { labelKey: string } }) => (
    <div data-testid="activity-change-panel">{change.labelKey}</div>
  ),
}));

jest.mock('utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: (type: string, fqn: string) => `/${type}/${fqn}`,
  },
}));

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children?: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: mockShowErrorToast,
}));

jest.mock('components/ActivityFeed/Reactions/Reactions', () => ({
  __esModule: true,
  default: ({
    reactions,
    onReactionSelect,
  }: {
    reactions: unknown[];
    onReactionSelect: (r: string, o: string) => void;
  }) => (
    <div>
      <button
        data-testid="react-btn"
        onClick={() => onReactionSelect('heart', 'add')}>
        {`r${reactions.length}`}
      </button>
      <button
        aria-label="remove reaction"
        data-testid="react-remove-btn"
        onClick={() => onReactionSelect('heart', 'remove')}
      />
    </div>
  ),
}));

// Boundary stub: the real chip renders the OSS user popover.
jest.mock('components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('components/common/RichTextEditor/RichTextEditorPreviewerV1', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));

jest.mock('../../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: { getEntityIcon: () => null },
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { id: 'u1', name: 'me', displayName: 'Me' },
  }),
}));

jest.mock('hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => [null, false, { name: 'alice', displayName: 'Alice' }],
}));

jest.mock('utils/date-time/DateTimeUtils', () => ({
  getRelativeTime: () => '12 min ago',
  getEpochMillisForPastDays: (days: number) => days,
  getStartOfDayInMillis: (ts: number) => ts,
  getEndOfDayInMillis: (ts: number) => ts,
  getCurrentMillis: () => 0,
  formatDateTime: () => 'Jun 05, 2026, 03:01 PM',
  // Echoes the format, so a test can tell a clock time from a dated one.
  formatDateTimeLong: (_: number, format?: string) =>
    format === 'hh:mm a' ? '03:01 PM' : `dated:${format}`,
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

jest.mock('utils/FeedUtils', () => ({
  getFrontEndFormat: (m: string) => m,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  BadgeWithIcon: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Button: ({
    children,
    onPress,
    ...props
  }: {
    children?: ReactNode;
    onPress?: () => void;
    'aria-pressed'?: boolean;
    'aria-expanded'?: boolean;
    'data-testid'?: string;
  }) => (
    <button
      aria-expanded={props['aria-expanded']}
      aria-pressed={props['aria-pressed']}
      data-testid={props['data-testid']}
      onClick={onPress}>
      {children}
    </button>
  ),
  // The card hands its root a ref for the on-screen check.
  Box: jest
    .requireActual('react')
    .forwardRef(
      (
        { children }: { children?: ReactNode },
        ref: React.Ref<HTMLDivElement>
      ) => <div ref={ref}>{children}</div>
    ),
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  ChevronDown: () => <span />,
  ChevronUp: () => <span />,
  Edit05: () => <span />,
  File02: () => <span />,
  Globe01: () => <span />,
  MessageDotsCircle: () => <span />,
  Plus: () => <span />,
  RefreshCcw01: () => <span />,
  Tag01: () => <span />,
  ThumbsUp: () => <span />,
  Trash01: () => <span />,
  UserCheck01: () => <span />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ActivityEvent } from '../../../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../../../generated/entity/feed/conversation';
import ActivityFeedItem from './ActivityFeedItem';

const baseActivity = {
  id: 'a1',
  actor: { id: 'a', name: 'alice', displayName: 'Alice', type: 'user' },
  summary: 'Updated style',
  reactions: [],
  entity: {
    type: 'table',
    name: 'dim',
    displayName: 'dim_address',
    fullyQualifiedName: 'svc.db.sch.dim',
  },
} as unknown as ActivityEvent;

const baseFeed = {
  id: 'f1',
  createdBy: { id: 'b', name: 'bob', displayName: 'Bob', type: 'user' },
  message: 'Hello thread',
  replyCount: 2,
  reactions: [],
  entityRef: { type: 'table', name: 'dim', displayName: 'dim_address' },
} as unknown as Conversation;

describe('ActivityFeedItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReplies = [];
  });

  it('renders actor, action, entity and message', () => {
    render(<ActivityFeedItem activity={baseActivity} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('updated description for')).toBeInTheDocument();
    expect(screen.getByText('dim_address')).toBeInTheDocument();
    expect(screen.getByText('Updated style')).toBeInTheDocument();
  });

  it('shows what changed in place of the summary when the change parses', () => {
    mockGetActivityChange.mockReturnValueOnce({
      labelKey: 'label.tag-plural',
      before: [],
      after: ['PII.Sensitive'],
      isText: false,
    });

    render(<ActivityFeedItem activity={baseActivity} />);

    expect(screen.getByTestId('activity-change-panel')).toHaveTextContent(
      'label.tag-plural'
    );
    expect(screen.queryByText('Updated style')).not.toBeInTheDocument();
  });

  it('links the asset line to the entity', () => {
    render(<ActivityFeedItem activity={baseActivity} />);

    expect(screen.getByRole('link', { name: 'dim_address' })).toHaveAttribute(
      'href',
      '/table/svc.db.sch.dim'
    );
  });

  it('names and links the column for a column-level change', () => {
    render(
      <ActivityFeedItem
        activity={
          {
            ...baseActivity,
            about: '<#E::table::svc.db.sch.dim::columns::email::tags>',
          } as ActivityEvent
        }
      />
    );

    expect(screen.getByText('dim_address.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'email' })).toHaveAttribute(
      'href',
      '/table/svc.db.sch.dim.email'
    );
  });

  it('flags a card that mentions the viewer, and only then', () => {
    const { rerender } = render(
      <ActivityFeedItem isMentioned feed={baseFeed} />
    );

    expect(screen.getByText('label.mentioned-you')).toBeInTheDocument();

    rerender(<ActivityFeedItem feed={baseFeed} />);

    expect(screen.queryByText('label.mentioned-you')).not.toBeInTheDocument();
  });

  it('renders a conversation with its message', () => {
    render(<ActivityFeedItem feed={baseFeed} />);

    expect(
      screen.getByText('message.activity-started-conversation')
    ).toBeInTheDocument();
    expect(screen.getByText('Hello thread')).toBeInTheDocument();
  });

  describe('time under a day header', () => {
    const at = (iso: string) => new Date(iso).getTime();

    it('shows a clock time for a conversation from the same day', () => {
      render(
        <ActivityFeedItem
          feed={
            {
              ...baseFeed,
              createdAt: at('2026-10-05T09:00:00'),
              updatedAt: at('2026-10-05T11:00:00'),
            } as Conversation
          }
          timeFormat="hh:mm a"
        />
      );

      expect(screen.getByText('03:01 PM')).toBeInTheDocument();
    });

    // Filed under the day of its last reply, a thread started earlier shows
    // its date, not a bare time that reads as today's.
    it('shows the date for a conversation started on an earlier day', () => {
      render(
        <ActivityFeedItem
          feed={
            {
              ...baseFeed,
              createdAt: at('2026-10-02T09:00:00'),
              updatedAt: at('2026-10-05T11:00:00'),
            } as Conversation
          }
          timeFormat="hh:mm a"
        />
      );

      expect(
        screen.getByText('dated:MMM dd, yyyy, hh:mm a')
      ).toBeInTheDocument();
    });
  });

  it('reacts to a conversation via the conversation endpoint', async () => {
    mockSendReaction.mockResolvedValue({});
    render(<ActivityFeedItem feed={baseFeed} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('react-btn'));
    });

    expect(mockSendReaction).toHaveBeenCalledWith(
      { activityId: undefined, conversationId: 'f1' },
      'heart',
      'add'
    );
    expect(screen.getByTestId('react-btn')).toHaveTextContent('r1');
  });

  it('shows a reaction before the server answers', async () => {
    let settle: () => void = () => undefined;
    mockSendReaction.mockReturnValue(
      new Promise<void>((resolve) => {
        settle = resolve;
      })
    );
    render(<ActivityFeedItem activity={baseActivity} />);

    act(() => {
      fireEvent.click(screen.getByTestId('react-btn'));
    });

    expect(screen.getByTestId('react-btn')).toHaveTextContent('r1');

    await act(async () => settle());

    expect(mockSendReaction).toHaveBeenCalledWith(
      { activityId: 'a1', conversationId: undefined },
      'heart',
      'add'
    );
  });

  it('drops the reaction on remove', async () => {
    mockSendReaction.mockResolvedValue({});
    const reacted = {
      ...baseActivity,
      reactions: [{ reactionType: 'heart', user: { id: 'u1' } }],
    } as unknown as ActivityEvent;

    render(<ActivityFeedItem activity={reacted} />);

    expect(screen.getByTestId('react-btn')).toHaveTextContent('r1');

    await act(async () => {
      fireEvent.click(screen.getByTestId('react-remove-btn'));
    });

    expect(mockSendReaction).toHaveBeenCalledWith(
      { activityId: 'a1', conversationId: undefined },
      'heart',
      'remove'
    );
    expect(screen.getByTestId('react-btn')).toHaveTextContent('r0');
  });

  // Two reactions in flight at once must both land: each builds on the
  // latest list, not the one its click rendered with.
  it('keeps both of two quick reactions', async () => {
    const pending: (() => void)[] = [];
    mockSendReaction.mockImplementation(
      () => new Promise<void>((resolve) => pending.push(resolve))
    );
    render(<ActivityFeedItem activity={baseActivity} />);

    act(() => {
      fireEvent.click(screen.getByTestId('activity-like'));
      fireEvent.click(screen.getByTestId('react-btn'));
    });
    await act(async () => pending.forEach((resolve) => resolve()));

    expect(mockSendReaction).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('activity-like')).toHaveTextContent(
      'label.like-with-count'
    );
    expect(screen.getByTestId('react-btn')).toHaveTextContent('r1');
  });

  // A double click on Like must not count the viewer twice.
  it('ignores a repeat of a reaction the viewer already has', async () => {
    mockSendReaction.mockReturnValue(new Promise(() => undefined));
    render(<ActivityFeedItem activity={baseActivity} />);

    act(() => {
      fireEvent.click(screen.getByTestId('react-btn'));
      fireEvent.click(screen.getByTestId('react-btn'));
    });

    expect(mockSendReaction).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('react-btn')).toHaveTextContent('r1');
  });

  it('rolls the reaction back and says so when the server refuses it', async () => {
    const err = new Error('fail');
    mockSendReaction.mockRejectedValue(err);

    render(<ActivityFeedItem activity={baseActivity} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('react-btn'));
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(err);
    expect(screen.getByTestId('react-btn')).toHaveTextContent('r0');
  });

  // A card read back from the cache after a sub-tab switch keeps it.
  it('writes the reactions back to the cached feeds', async () => {
    mockSendReaction.mockResolvedValue({});
    render(<ActivityFeedItem activity={baseActivity} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('react-btn'));
    });

    expect(mockWriteInboxReactions).toHaveBeenCalledWith('query-client', 'a1', [
      expect.objectContaining({
        reactionType: 'heart',
        user: expect.objectContaining({ id: 'u1' }),
      }),
    ]);
  });

  it('re-syncs local reactions when the activity prop changes', () => {
    const { rerender } = render(<ActivityFeedItem activity={baseActivity} />);

    expect(screen.getByTestId('react-btn')).toHaveTextContent('r0');

    rerender(
      <ActivityFeedItem
        activity={
          {
            ...baseActivity,
            reactions: [{ reactionType: 'heart' }],
          } as unknown as ActivityEvent
        }
      />
    );

    expect(screen.getByTestId('react-btn')).toHaveTextContent('r1');
  });

  it('likes the activity with the thumbs-up reaction', async () => {
    mockSendReaction.mockResolvedValue({});
    render(<ActivityFeedItem activity={baseActivity} />);

    expect(screen.getByTestId('activity-like')).toHaveTextContent('label.like');

    await act(async () => {
      fireEvent.click(screen.getByTestId('activity-like'));
    });

    expect(mockSendReaction).toHaveBeenCalledWith(
      { activityId: 'a1', conversationId: undefined },
      'thumbsUp',
      'add'
    );
    expect(screen.getByTestId('activity-like')).toHaveTextContent(
      'label.like-with-count'
    );
    expect(screen.getByTestId('activity-like')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // Likes stay out of the emoji row.
    expect(screen.getByTestId('react-btn')).toHaveTextContent('r0');
  });

  it('removes the like when the viewer already liked it', async () => {
    mockSendReaction.mockResolvedValue({});
    const liked = {
      ...baseActivity,
      reactions: [{ reactionType: 'thumbsUp', user: { id: 'u1' } }],
    } as unknown as ActivityEvent;

    render(<ActivityFeedItem activity={liked} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('activity-like'));
    });

    expect(mockSendReaction).toHaveBeenCalledWith(
      { activityId: 'a1', conversationId: undefined },
      'thumbsUp',
      'remove'
    );
    expect(screen.getByTestId('activity-like')).toHaveTextContent('label.like');
  });

  describe('thread', () => {
    const reply = (id: string, name: string) => ({ id, author: { name } });

    it('opens the thread with the composer focused from Reply', () => {
      render(<ActivityFeedItem activity={baseActivity} />);

      expect(screen.queryByTestId('activity-thread')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('activity-reply'));

      expect(screen.getByTestId('activity-thread')).toHaveAttribute(
        'data-focus-composer',
        'true'
      );
    });

    it('shows no replies toggle until there are replies', () => {
      render(<ActivityFeedItem activity={baseActivity} />);

      expect(
        screen.queryByTestId('activity-replies-toggle')
      ).not.toBeInTheDocument();
    });

    it('counts the replies on the toggle, which opens and hides them', () => {
      mockReplies = [reply('r1', 'bob'), reply('r2', 'carol')];
      render(<ActivityFeedItem activity={baseActivity} />);
      const toggle = screen.getByTestId('activity-replies-toggle');

      expect(toggle).toHaveTextContent('label.number-reply-plural');

      fireEvent.click(toggle);

      expect(screen.getByTestId('activity-thread')).toHaveAttribute(
        'data-focus-composer',
        'false'
      );
      expect(toggle).toHaveTextContent('label.hide-reply-plural');
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(toggle);

      expect(screen.queryByTestId('activity-thread')).not.toBeInTheDocument();
    });

    // Opened with Reply, or emptied by a delete: the thread can still close.
    it('keeps a way to close a thread that has no replies', () => {
      render(<ActivityFeedItem activity={baseActivity} />);

      fireEvent.click(screen.getByTestId('activity-reply'));
      const toggle = screen.getByTestId('activity-replies-toggle');

      expect(toggle).toHaveTextContent('label.hide-reply-plural');

      fireEvent.click(toggle);

      expect(screen.queryByTestId('activity-thread')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('activity-replies-toggle')
      ).not.toBeInTheDocument();
    });

    it('reads one reply as one', () => {
      mockReplies = [reply('r1', 'bob')];
      render(<ActivityFeedItem activity={baseActivity} />);

      expect(screen.getByTestId('activity-replies-toggle')).toHaveTextContent(
        'label.one-reply'
      );
    });

    it('posts a reply to the activity and re-reads the thread', async () => {
      mockCreateThreadReply.mockResolvedValue({});
      render(<ActivityFeedItem activity={baseActivity} />);

      fireEvent.click(screen.getByTestId('activity-reply'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('activity-thread'));
      });

      expect(mockCreateThreadReply).toHaveBeenCalledWith('hello', {
        activityId: 'a1',
        conversationId: undefined,
      });
      expect(mockRefetchReplies).toHaveBeenCalled();
    });

    // e.g. a reply on an activity whose asset was deleted is refused.
    it('shows the refusal when a reply fails', async () => {
      const err = new Error('read-only');
      mockCreateThreadReply.mockRejectedValue(err);
      render(<ActivityFeedItem activity={baseActivity} />);

      fireEvent.click(screen.getByTestId('activity-reply'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('activity-thread'));
      });

      expect(mockShowErrorToast).toHaveBeenCalledWith(err);
      expect(mockRefetchReplies).not.toHaveBeenCalled();
      // Rejecting is what tells the composer to put the draft back.
      expect(mockReplyRejected).toHaveBeenCalledWith(err);
    });
  });
});
