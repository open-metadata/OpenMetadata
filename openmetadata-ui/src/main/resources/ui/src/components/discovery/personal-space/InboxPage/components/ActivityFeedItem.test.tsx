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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';

const mockToggle = jest.fn();
const mockToggleConversation = jest.fn();
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
jest.mock('./ActivityThread', () => ({
  __esModule: true,
  default: ({
    focusComposer,
    onReply,
  }: {
    focusComposer: boolean;
    onReply: (message: string) => void;
  }) => (
    <button
      data-focus-composer={String(focusComposer)}
      data-testid="activity-thread"
      onClick={() => onReply('hello')}>
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
  toggleActivityReaction: (...args: unknown[]) => mockToggle(...args),
  toggleConversationReaction: (...args: unknown[]) =>
    mockToggleConversation(...args),
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
  formatDateTimeLong: () => '03:01 PM',
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

jest.mock('@untitledui/icons', () => ({
  ChevronDown: () => <span />,
  ChevronUp: () => <span />,
  Edit05: () => <span />,
  MessageCircle01: () => <span />,
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

  it('renders a conversation with its message', () => {
    render(<ActivityFeedItem feed={baseFeed} />);

    expect(
      screen.getByText('message.activity-started-conversation')
    ).toBeInTheDocument();
    expect(screen.getByText('Hello thread')).toBeInTheDocument();
  });

  it('reacts to a conversation via the conversation endpoint', async () => {
    mockToggleConversation.mockResolvedValue([
      { reactionType: 'heart', user: { id: 'u1' } },
    ]);
    render(<ActivityFeedItem feed={baseFeed} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('react-btn'));
    });

    expect(mockToggleConversation).toHaveBeenCalledWith(
      'f1',
      expect.any(Array),
      'heart',
      'add',
      expect.objectContaining({ id: 'u1' })
    );
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('updates reactions on a successful toggle', async () => {
    mockToggle.mockResolvedValue([
      { reactionType: 'heart', user: { id: 'u1' } },
    ]);

    render(<ActivityFeedItem activity={baseActivity} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('react-btn'));
    });

    expect(mockToggle).toHaveBeenCalledWith(
      'a1',
      expect.any(Array),
      'heart',
      'add',
      expect.objectContaining({ id: 'u1' })
    );

    await waitFor(() =>
      expect(screen.getByTestId('react-btn')).toHaveTextContent('r1')
    );
  });

  it('drops the reaction on a successful remove toggle', async () => {
    const reacted = {
      ...baseActivity,
      reactions: [{ reactionType: 'heart', user: { id: 'u1' } }],
    } as unknown as ActivityEvent;
    mockToggle.mockResolvedValue([]);

    render(<ActivityFeedItem activity={reacted} />);

    expect(screen.getByTestId('react-btn')).toHaveTextContent('r1');

    await act(async () => {
      fireEvent.click(screen.getByTestId('react-remove-btn'));
    });

    expect(mockToggle).toHaveBeenCalledWith(
      'a1',
      expect.any(Array),
      'heart',
      'remove',
      expect.objectContaining({ id: 'u1' })
    );

    await waitFor(() =>
      expect(screen.getByTestId('react-btn')).toHaveTextContent('r0')
    );
  });

  it('keeps accepting toggles after a reaction change (not latched)', async () => {
    mockToggle
      .mockResolvedValueOnce([{ reactionType: 'heart', user: { id: 'u1' } }])
      .mockResolvedValueOnce([]);

    render(<ActivityFeedItem activity={baseActivity} />);

    // Add, then remove the same reaction: the second toggle must still fire
    // (the Reactions remount keys off the reaction set, clearing any latch).
    await act(async () => {
      fireEvent.click(screen.getByTestId('react-btn'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('react-btn')).toHaveTextContent('r1')
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('react-remove-btn'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('react-btn')).toHaveTextContent('r0')
    );

    expect(mockToggle).toHaveBeenCalledTimes(2);
  });

  it('shows an error toast when the reaction toggle rejects', async () => {
    const err = new Error('fail');
    mockToggle.mockRejectedValue(err);

    render(<ActivityFeedItem activity={baseActivity} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('react-btn'));
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(err);
    expect(screen.getByTestId('react-btn')).toHaveTextContent('r0');
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
    mockToggle.mockResolvedValue([
      { reactionType: 'thumbsUp', user: { id: 'u1' } },
    ]);

    render(<ActivityFeedItem activity={baseActivity} />);

    expect(screen.getByTestId('activity-like')).toHaveTextContent('label.like');

    await act(async () => {
      fireEvent.click(screen.getByTestId('activity-like'));
    });

    expect(mockToggle).toHaveBeenCalledWith(
      'a1',
      expect.any(Array),
      'thumbsUp',
      'add',
      expect.objectContaining({ id: 'u1' })
    );
    expect(screen.getByTestId('activity-like')).toHaveTextContent(
      'label.like · 1'
    );
    expect(screen.getByTestId('activity-like')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // Likes stay out of the emoji row.
    expect(screen.getByTestId('react-btn')).toHaveTextContent('r0');
  });

  it('removes the like when the viewer already liked it', async () => {
    mockToggle.mockResolvedValue([]);
    const liked = {
      ...baseActivity,
      reactions: [{ reactionType: 'thumbsUp', user: { id: 'u1' } }],
    } as unknown as ActivityEvent;

    render(<ActivityFeedItem activity={liked} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('activity-like'));
    });

    expect(mockToggle).toHaveBeenCalledWith(
      'a1',
      expect.any(Array),
      'thumbsUp',
      'remove',
      expect.objectContaining({ id: 'u1' })
    );
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
    });
  });
});
