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

jest.mock('../inbox.utils', () => ({
  formatActivityTime: () => '12 min ago',
  getActivityEventLabel: () => 'updated description for',
  toggleActivityReaction: (...args: unknown[]) => mockToggle(...args),
  toggleConversationReaction: (...args: unknown[]) =>
    mockToggleConversation(...args),
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
  Box: ({
    children,
    onClick,
    onKeyDown,
  }: {
    children?: ReactNode;
    onClick?: (...args: unknown[]) => void;
    onKeyDown?: (...args: unknown[]) => void;
  }) => (
    <div role="presentation" onClick={onClick} onKeyDown={onKeyDown}>
      {children}
    </div>
  ),
  Card: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('@untitledui/icons', () => ({ MessageDotsCircle: () => <span /> }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ActivityEvent } from 'generated/entity/activity/activityEvent';
import { Conversation } from 'generated/entity/feed/conversation';
import ActivityFeedItem from './ActivityFeedItem';

const baseActivity = {
  id: 'a1',
  actor: { id: 'a', name: 'alice', displayName: 'Alice', type: 'user' },
  summary: 'Updated style',
  reactions: [],
  entity: { type: 'table', name: 'dim', displayName: 'dim_address' },
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
  beforeEach(() => jest.clearAllMocks());

  it('renders actor, action, entity chip and message without a comment affordance', () => {
    render(<ActivityFeedItem activity={baseActivity} onClick={jest.fn()} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('updated description for')).toBeInTheDocument();
    expect(screen.getByText('dim_address')).toBeInTheDocument();
    expect(screen.getByText('Updated style')).toBeInTheDocument();
    // Change-event activities are read-only — no comment affordance.
    expect(screen.queryByText('label.comment-plural')).not.toBeInTheDocument();
  });

  it('fires onClick with the activity selection when the card is activated', () => {
    const onClick = jest.fn();
    render(<ActivityFeedItem activity={baseActivity} onClick={onClick} />);

    fireEvent.click(screen.getByText('Alice'));

    expect(onClick).toHaveBeenCalledWith({ activity: baseActivity });
  });

  it('renders a conversation with its reply count', () => {
    render(<ActivityFeedItem feed={baseFeed} onClick={jest.fn()} />);

    expect(screen.getByText('label.posted-on')).toBeInTheDocument();
    expect(screen.getByText('Hello thread')).toBeInTheDocument();
    expect(screen.getByText('2 label.comment-plural')).toBeInTheDocument();
  });

  it('emits the feed selection and reacts via the conversation endpoint', async () => {
    mockToggleConversation.mockResolvedValue([
      { reactionType: 'heart', user: { id: 'u1' } },
    ]);
    const onClick = jest.fn();
    render(<ActivityFeedItem feed={baseFeed} onClick={onClick} />);

    fireEvent.click(screen.getByText('label.posted-on'));

    expect(onClick).toHaveBeenCalledWith({ feed: baseFeed });

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

    render(<ActivityFeedItem activity={baseActivity} onClick={jest.fn()} />);

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

    render(<ActivityFeedItem activity={reacted} onClick={jest.fn()} />);

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

    render(<ActivityFeedItem activity={baseActivity} onClick={jest.fn()} />);

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

    render(<ActivityFeedItem activity={baseActivity} onClick={jest.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('react-btn'));
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(err);
    expect(screen.getByTestId('react-btn')).toHaveTextContent('r0');
  });

  it('re-syncs local reactions when the activity prop changes', () => {
    const { rerender } = render(
      <ActivityFeedItem activity={baseActivity} onClick={jest.fn()} />
    );

    expect(screen.getByTestId('react-btn')).toHaveTextContent('r0');

    rerender(
      <ActivityFeedItem
        activity={
          {
            ...baseActivity,
            reactions: [{ reactionType: 'heart' }],
          } as unknown as ActivityEvent
        }
        onClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('react-btn')).toHaveTextContent('r1');
  });
});
