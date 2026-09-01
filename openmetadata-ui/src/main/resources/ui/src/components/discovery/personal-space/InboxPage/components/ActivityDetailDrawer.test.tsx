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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComponentProps, ReactNode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

const mockListReplies = jest.fn();
const mockCreateReply = jest.fn();
const mockPatchReply = jest.fn();
const mockDeleteReply = jest.fn();
const mockShowErrorToast = jest.fn();
const mockGetResourcePermission = jest.fn();

let mockCurrentUser: { name?: string; isAdmin?: boolean } = { name: 'bob' };

jest.mock('rest/conversationsAPI', () => ({
  listConversationReplies: (...a: unknown[]) => mockListReplies(...a),
  createConversationReply: (...a: unknown[]) => mockCreateReply(...a),
  patchConversationReply: (...a: unknown[]) => mockPatchReply(...a),
  deleteConversationReply: (...a: unknown[]) => mockDeleteReply(...a),
}));

jest.mock('rest/permissionAPI', () => ({
  getResourcePermission: (...a: unknown[]) => mockGetResourcePermission(...a),
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock('fast-json-patch', () => ({
  compare: () => [{ op: 'replace', path: '/message', value: 'edited' }],
}));

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: mockShowErrorToast,
}));

jest.mock('utils/FeedUtils', () => ({
  getFrontEndFormat: (m: string) => m,
}));

jest.mock('utils/FeedUtilsPure', () => ({
  getFrontEndFormat: (m: string) => m,
  MarkdownToHTMLConverter: { makeHtml: (m: string) => m },
}));

jest.mock('../inbox.utils', () => ({
  formatActivityTime: () => '12 min ago',
  getActivityEventLabel: () => 'updated description for',
  getActivityActionLabel: () => 'started a conversation on',
  getFeedTimestamp: () => 1700000000000,
}));

jest.mock('components/common/DeleteModal/DeleteModal', () => ({
  __esModule: true,
  default: ({ open, onDelete }: { open: boolean; onDelete: () => void }) =>
    open ? (
      <button data-testid="confirm-delete-message" onClick={onDelete}>
        delete
      </button>
    ) : null,
}));

jest.mock(
  'components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew',
  () => ({
    __esModule: true,
    default: ({
      onSave,
      'data-testid': testId,
    }: {
      onSave: (m: string) => void;
      'data-testid'?: string;
    }) => (
      <button
        data-testid={testId ?? 'add-comment'}
        onClick={() => onSave('hello')}>
        editor
      </button>
    ),
  })
);

// Boundary stub: the real chip renders the OSS user popover.
jest.mock('components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('components/common/RichTextEditor/RichTextEditorPreviewerV1', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));

jest.mock('hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => [null, false, { name: 'bob', displayName: 'Bob' }],
}));

jest.mock('utils/date-time/DateTimeUtils', () => ({
  getRelativeTime: () => 'now',
  getEpochMillisForPastDays: (days: number) => days,
  getStartOfDayInMillis: (ts: number) => ts,
  getEndOfDayInMillis: (ts: number) => ts,
  getCurrentMillis: () => 0,
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

jest.mock('utils/TableUtils', () => ({
  getEntityIcon: () => null,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Box: ({
    children,
    onMouseEnter,
    onMouseLeave,
    ...rest
  }: {
    children?: ReactNode;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    'data-testid'?: string;
  }) => (
    <div
      data-testid={rest['data-testid']}
      role="presentation"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}>
      {children}
    </div>
  ),
  Button: ({
    children,
    onPress,
    ...rest
  }: {
    children?: ReactNode;
    onPress?: () => void;
    'data-testid'?: string;
  }) => (
    <button data-testid={rest['data-testid']} onClick={onPress}>
      {children}
    </button>
  ),
  ButtonUtility: ({
    icon,
    onClick,
    ...rest
  }: {
    icon?: ReactNode;
    onClick?: () => void;
    'aria-label'?: string;
    'data-testid'?: string;
  }) => (
    <button
      aria-label={rest['aria-label']}
      data-testid={rest['data-testid']}
      onClick={onClick}>
      {icon}
    </button>
  ),
  Skeleton: () => <span data-testid="skeleton" />,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  ModalOverlay: ({
    isOpen,
    children,
  }: {
    isOpen?: boolean;
    children?: ReactNode;
  }) => (isOpen ? <div>{children}</div> : null),
  Modal: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock('@untitledui/icons', () => ({
  X: () => <span />,
  Maximize02: () => <span />,
  Minimize02: () => <span />,
  Edit01: (props: ComponentProps<'span'>) => <span {...props} />,
  Trash01: (props: ComponentProps<'span'>) => <span {...props} />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ActivityEvent } from '../../../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../../../generated/entity/feed/conversation';
import ActivityDetailDrawer from './ActivityDetailDrawer';

const activityA = {
  id: 'A',
  about: '<#E::table::db.tblA::description>',
  actor: { name: 'alice', displayName: 'Alice' },
  summary: 'msg A',
  entity: { type: 'table', name: 'tblA' },
} as unknown as ActivityEvent;

const feedA = {
  id: 'T-A',
  message: 'conversation A',
  createdBy: { id: 'u', name: 'alice', displayName: 'Alice', type: 'user' },
  createdAt: 1,
  entityRef: { type: 'table', name: 'tblA' },
} as unknown as Conversation;
const feedB = {
  id: 'T-B',
  message: 'conversation B',
  createdBy: { id: 'u', name: 'alice', displayName: 'Alice', type: 'user' },
  createdAt: 2,
  entityRef: { type: 'table', name: 'tblB' },
} as unknown as Conversation;

const allow = (access: string) => ({
  permissions: [{ operation: 'Delete', access }],
});

interface DrawerProps {
  activity?: ActivityEvent;
  feed?: Conversation;
  onPosted?: jest.Mock;
  onClose?: jest.Mock;
}

// Fresh QueryClient per render: the permission query key is constant with
// staleTime Infinity, so a shared client would leak one test's mocked access
// into the next.
const renderDrawer = ({ activity, feed, onPosted, onClose }: DrawerProps) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ActivityDetailDrawer
        open
        activity={activity}
        feed={feed}
        onClose={onClose ?? jest.fn()}
        onPosted={onPosted}
      />
    </QueryClientProvider>
  );
};

const renderWithComment = async (props: DrawerProps = { feed: feedA }) => {
  mockListReplies.mockResolvedValue({
    data: [
      {
        id: 'p1',
        author: { id: 'bob', name: 'bob', displayName: 'bob', type: 'user' },
        message: 'comment one',
        createdAt: 1,
      },
    ],
  });
  let view: ReturnType<typeof render> = undefined as never;
  await act(async () => {
    view = renderDrawer(props);
  });
  await waitFor(() =>
    expect(screen.getByText('comment one')).toBeInTheDocument()
  );
  fireEvent.mouseEnter(screen.getByTestId('feed-reply-card'));

  return view;
};

describe('ActivityDetailDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { name: 'bob' };
    mockGetResourcePermission.mockResolvedValue(allow('conditionalAllow'));
  });

  describe('read-only activities (upstream parity)', () => {
    it('renders an activity without composer or comment thread', async () => {
      await act(async () => {
        renderDrawer({ activity: activityA });
      });

      expect(screen.getByText('msg A')).toBeInTheDocument();
      expect(screen.queryByTestId('add-comment')).not.toBeInTheDocument();
      expect(screen.queryByTestId('feed-reply-card')).not.toBeInTheDocument();
      expect(mockListReplies).not.toHaveBeenCalled();
      expect(mockCreateReply).not.toHaveBeenCalled();
    });

    it('does not preflight the conversation permission for an activity', async () => {
      await act(async () => {
        renderDrawer({ activity: activityA });
      });

      expect(mockGetResourcePermission).not.toHaveBeenCalled();
    });
  });

  describe('conversation thread', () => {
    it('loads the posts of the conversation feed', async () => {
      mockListReplies.mockResolvedValue({
        data: [
          {
            id: 'p1',
            author: {
              id: 'bob',
              name: 'bob',
              displayName: 'bob',
              type: 'user',
            },
            message: 'comment one',
            createdAt: 1,
          },
        ],
      });

      await act(async () => {
        renderDrawer({ feed: feedA });
      });

      expect(mockListReplies).toHaveBeenCalledWith('T-A');

      await waitFor(() =>
        expect(screen.getByText('comment one')).toBeInTheDocument()
      );
    });

    it('shows a skeleton while the posts are loading', async () => {
      let resolvePosts!: (value: unknown) => void;
      mockListReplies.mockReturnValue(
        new Promise((resolve) => {
          resolvePosts = resolve;
        })
      );

      await act(async () => {
        renderDrawer({ feed: feedA });
      });

      expect(screen.getByTestId('comments-skeleton')).toBeInTheDocument();

      await act(async () => {
        resolvePosts({ data: [] });
      });

      expect(screen.queryByTestId('comments-skeleton')).not.toBeInTheDocument();
    });

    it('clears stale posts when switching to another conversation', async () => {
      mockListReplies
        .mockResolvedValueOnce({
          data: [
            {
              id: 'p1',
              author: { id: 'a', name: 'a', displayName: 'a', type: 'user' },
              message: 'A comment',
              createdAt: 1,
            },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: 'p2',
              author: { id: 'b', name: 'b', displayName: 'b', type: 'user' },
              message: 'B comment',
              createdAt: 1,
            },
          ],
        });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      let view: ReturnType<typeof render>;
      await act(async () => {
        view = render(
          <QueryClientProvider client={queryClient}>
            <ActivityDetailDrawer open feed={feedA} onClose={jest.fn()} />
          </QueryClientProvider>
        );
      });
      await waitFor(() =>
        expect(screen.getByText('A comment')).toBeInTheDocument()
      );

      await act(async () => {
        view.rerender(
          <QueryClientProvider client={queryClient}>
            <ActivityDetailDrawer open feed={feedB} onClose={jest.fn()} />
          </QueryClientProvider>
        );
      });

      await waitFor(() =>
        expect(screen.getByText('B comment')).toBeInTheDocument()
      );

      expect(screen.queryByText('A comment')).not.toBeInTheDocument();
      expect(mockListReplies).toHaveBeenLastCalledWith('T-B');
    });

    it('posts a comment to the conversation and refreshes', async () => {
      mockListReplies.mockResolvedValue({ data: [] });
      mockCreateReply.mockResolvedValue({});
      const onPosted = jest.fn();

      await act(async () => {
        renderDrawer({ feed: feedA, onPosted });
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-comment'));
      });

      expect(mockCreateReply).toHaveBeenCalledWith('T-A', { message: 'hello' });
      expect(onPosted).toHaveBeenCalledWith('T-A');
    });

    it('shows an error toast when posting a comment fails', async () => {
      mockListReplies.mockResolvedValue({ data: [] });
      const err = new Error('post fail');
      mockCreateReply.mockRejectedValue(err);

      await act(async () => {
        renderDrawer({ feed: feedA });
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-comment'));
      });

      expect(mockShowErrorToast).toHaveBeenCalledWith(err);
    });

    it('shows an error toast when the posts fail to load', async () => {
      const err = new Error('load fail');
      mockListReplies.mockRejectedValue(err);

      await act(async () => {
        renderDrawer({ feed: feedA });
      });

      await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalledWith(err));
    });

    it('preflights the conversation permission exactly once for many comments', async () => {
      mockListReplies.mockResolvedValue({
        data: [
          {
            id: 'p1',
            author: {
              id: 'bob',
              name: 'bob',
              displayName: 'bob',
              type: 'user',
            },
            message: 'comment one',
            createdAt: 1,
          },
          {
            id: 'p2',
            author: {
              id: 'bob',
              name: 'bob',
              displayName: 'bob',
              type: 'user',
            },
            message: 'comment two',
            createdAt: 1,
          },
        ],
      });

      await act(async () => {
        renderDrawer({ feed: feedA });
      });
      await waitFor(() =>
        expect(screen.getByText('comment two')).toBeInTheDocument()
      );

      expect(mockGetResourcePermission).toHaveBeenCalledTimes(1);
      expect(mockGetResourcePermission).toHaveBeenCalledWith('conversation');
    });
  });

  describe('comment editing', () => {
    it('lets the author edit a comment', async () => {
      mockPatchReply.mockResolvedValue({});
      await renderWithComment();

      expect(screen.getByTestId('edit-message')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId('edit-message'));
      });
      const editBox = screen.getByTestId('edit-message-editor');
      await act(async () => {
        fireEvent.click(within(editBox).getByTestId('add-comment'));
      });

      expect(mockPatchReply).toHaveBeenCalledWith('T-A', 'p1', [
        { op: 'replace', path: '/message', value: 'edited' },
      ]);
      // Reload after edit (initial load + reload = 2 calls).
      expect(mockListReplies).toHaveBeenCalledTimes(2);
    });

    it('keeps the hovered row mounted while the post-edit refresh is in flight', async () => {
      mockPatchReply.mockResolvedValue({});
      await renderWithComment();

      let resolveRefresh!: (value: unknown) => void;
      mockListReplies.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRefresh = resolve;
        })
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('edit-message'));
      });
      const editBox = screen.getByTestId('edit-message-editor');
      await act(async () => {
        fireEvent.click(within(editBox).getByTestId('add-comment'));
      });

      expect(screen.queryByTestId('comments-skeleton')).not.toBeInTheDocument();
      expect(screen.getByTestId('feed-reply-card')).toBeInTheDocument();
      expect(screen.getByTestId('delete-message')).toBeInTheDocument();

      await act(async () => {
        resolveRefresh({
          data: [
            {
              id: 'p1',
              author: {
                id: 'bob',
                name: 'bob',
                displayName: 'bob',
                type: 'user',
              },
              message: 'comment one edited',
              createdAt: 1,
            },
          ],
        });
      });

      expect(screen.getByText('comment one edited')).toBeInTheDocument();
      expect(screen.getByTestId('delete-message')).toBeInTheDocument();
    });

    it('cancels edit mode without saving', async () => {
      await renderWithComment();

      await act(async () => {
        fireEvent.click(screen.getByTestId('edit-message'));
      });

      expect(screen.getByTestId('edit-message-editor')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId('cancel-edit-message'));
      });

      expect(
        screen.queryByTestId('edit-message-editor')
      ).not.toBeInTheDocument();
      expect(mockPatchReply).not.toHaveBeenCalled();
    });
  });

  describe('comment deletion', () => {
    it('lets the author delete a comment after confirming and refreshes the count', async () => {
      mockDeleteReply.mockResolvedValue({});
      const onPosted = jest.fn();
      await renderWithComment({ feed: feedA, onPosted });

      await waitFor(() =>
        expect(screen.getByTestId('delete-message')).toBeInTheDocument()
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId('delete-message'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('confirm-delete-message'));
      });

      expect(mockDeleteReply).toHaveBeenCalledWith('T-A', 'p1');
      expect(mockListReplies).toHaveBeenCalledTimes(2);
      // Parent count badge is refreshed, matching add-comment behaviour.
      expect(onPosted).toHaveBeenCalledWith('T-A');
    });

    it('closes the confirmation dialog and toasts once when the delete fails', async () => {
      const err = new Error('delete fail');
      mockDeleteReply.mockRejectedValue(err);
      await renderWithComment();

      await waitFor(() =>
        expect(screen.getByTestId('delete-message')).toBeInTheDocument()
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId('delete-message'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('confirm-delete-message'));
      });

      expect(mockShowErrorToast).toHaveBeenCalledTimes(1);
      expect(mockShowErrorToast).toHaveBeenCalledWith(err);
      // Dialog closes on failure — retry clicks cannot stack toasts.
      expect(
        screen.queryByTestId('confirm-delete-message')
      ).not.toBeInTheDocument();
    });
  });

  describe('delete gating by evaluated conversation permission', () => {
    it('shows delete to the author under conditionalAllow (default isOwner rule)', async () => {
      await renderWithComment();

      await waitFor(() =>
        expect(screen.getByTestId('delete-message')).toBeInTheDocument()
      );

      expect(screen.getByTestId('edit-message')).toBeInTheDocument();
    });

    it.each(['deny', 'conditionalDeny', 'notAllow'])(
      'hides delete from the author when access is %s but keeps edit',
      async (access) => {
        mockGetResourcePermission.mockResolvedValue(allow(access));
        await renderWithComment();

        await waitFor(() =>
          expect(mockGetResourcePermission).toHaveBeenCalled()
        );

        expect(screen.getByTestId('edit-message')).toBeInTheDocument();
        expect(screen.queryByTestId('delete-message')).not.toBeInTheDocument();
      }
    );

    it('shows delete to a non-author when access is an unconditional allow', async () => {
      mockCurrentUser = { name: 'carol' };
      mockGetResourcePermission.mockResolvedValue(allow('allow'));
      await renderWithComment();

      await waitFor(() =>
        expect(screen.getByTestId('delete-message')).toBeInTheDocument()
      );

      expect(screen.queryByTestId('edit-message')).not.toBeInTheDocument();
    });

    it('hides delete from a non-author under conditionalAllow', async () => {
      mockCurrentUser = { name: 'carol' };
      await renderWithComment();

      await waitFor(() => expect(mockGetResourcePermission).toHaveBeenCalled());

      expect(screen.queryByTestId('edit-message')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-message')).not.toBeInTheDocument();
    });

    it('shows delete to an admin without preflighting the permission', async () => {
      mockCurrentUser = { name: 'carol', isAdmin: true };
      await renderWithComment();

      expect(screen.getByTestId('delete-message')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-message')).not.toBeInTheDocument();
      // Admins bypass policy evaluation server-side — no fetch.
      expect(mockGetResourcePermission).not.toHaveBeenCalled();
    });

    it('hides delete while the permission is still loading', async () => {
      mockGetResourcePermission.mockReturnValue(new Promise(() => undefined));
      await renderWithComment();

      expect(screen.getByTestId('edit-message')).toBeInTheDocument();
      expect(screen.queryByTestId('delete-message')).not.toBeInTheDocument();
    });

    it('hides delete when the permission preflight fails', async () => {
      mockGetResourcePermission.mockRejectedValue(new Error('perm fail'));
      await renderWithComment();

      await waitFor(() => expect(mockGetResourcePermission).toHaveBeenCalled());

      expect(screen.getByTestId('edit-message')).toBeInTheDocument();
      expect(screen.queryByTestId('delete-message')).not.toBeInTheDocument();
    });

    it('defaults to hidden when the response has no Delete operation', async () => {
      mockGetResourcePermission.mockResolvedValue({
        permissions: [{ operation: 'ViewAll', access: 'allow' }],
      });
      await renderWithComment();

      await waitFor(() => expect(mockGetResourcePermission).toHaveBeenCalled());

      expect(screen.queryByTestId('delete-message')).not.toBeInTheDocument();
    });

    it('shows no actions when neither the author nor the current user is named', async () => {
      mockCurrentUser = {};
      mockListReplies.mockResolvedValue({
        data: [{ id: 'p1', message: 'comment one' }],
      });
      await act(async () => {
        renderDrawer({ feed: feedA });
      });
      await waitFor(() =>
        expect(screen.getByText('comment one')).toBeInTheDocument()
      );
      fireEvent.mouseEnter(screen.getByTestId('feed-reply-card'));

      expect(screen.queryByTestId('edit-message')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-message')).not.toBeInTheDocument();
    });
  });

  describe('drawer header controls', () => {
    it('closes the drawer from the header close button', async () => {
      const onClose = jest.fn();

      await act(async () => {
        renderDrawer({ activity: activityA, onClose });
      });

      fireEvent.click(screen.getByTestId('close-drawer'));

      expect(onClose).toHaveBeenCalled();
    });

    it('toggles the header button between expand and collapse', async () => {
      await act(async () => {
        renderDrawer({ activity: activityA });
      });

      fireEvent.click(screen.getByRole('button', { name: 'label.expand' }));

      expect(
        screen.getByRole('button', { name: 'label.collapse' })
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'label.collapse' }));

      expect(
        screen.getByRole('button', { name: 'label.expand' })
      ).toBeInTheDocument();
    });
  });
});
