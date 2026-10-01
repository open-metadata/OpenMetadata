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

const mockPatchReply = jest.fn();
const mockDeleteReply = jest.fn();
const mockAddReplyReaction = jest.fn();
const mockRemoveReplyReaction = jest.fn();
const mockShowErrorToast = jest.fn();
let mockDeleteAccess: string | undefined;
let mockCurrentUser: { name?: string; isAdmin?: boolean } = { name: 'bob' };

jest.mock('rest/conversationsAPI', () => ({
  patchConversationReply: (...a: unknown[]) => mockPatchReply(...a),
  deleteConversationReply: (...a: unknown[]) => mockDeleteReply(...a),
  addConversationReplyReaction: (...a: unknown[]) => mockAddReplyReaction(...a),
  removeConversationReplyReaction: (...a: unknown[]) =>
    mockRemoveReplyReaction(...a),
}));

jest.mock('../useFeedDeleteAccess', () => ({
  useFeedDeleteAccess: () => mockDeleteAccess,
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock('hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => [null, false, undefined],
}));

jest.mock('fast-json-patch', () => ({
  compare: () => [{ op: 'replace', path: '/message', value: 'edited' }],
}));

jest.mock('utils/ToastUtils', () => ({ showErrorToast: mockShowErrorToast }));

jest.mock('utils/FeedUtilsPure', () => ({
  getFrontEndFormat: (m: string) => m,
  MarkdownToHTMLConverter: { makeHtml: (m: string) => m },
}));

jest.mock('../inbox.utils', () => ({ formatActivityTime: () => '12 min ago' }));

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
    default: ({ onSave }: { onSave: (m: string) => void }) => (
      <button data-testid="save-edit" onClick={() => onSave('edited')}>
        editor
      </button>
    ),
  })
);

jest.mock('./InboxCommentComposer', () => ({
  __esModule: true,
  default: ({
    focused,
    onSave,
  }: {
    focused?: boolean;
    onSave: (m: string) => void;
  }) => (
    <button
      data-focused={String(Boolean(focused))}
      data-testid="inbox-comment-composer"
      onClick={() => onSave('hello')}>
      composer
    </button>
  ),
}));

jest.mock('components/ActivityFeed/Reactions/Reactions', () => ({
  __esModule: true,
  default: ({
    onReactionSelect,
  }: {
    onReactionSelect: (r: string, o: string) => void;
  }) => (
    <>
      <button onClick={() => onReactionSelect('heart', 'add')}>react</button>
      <button onClick={() => onReactionSelect('heart', 'remove')}>
        unreact
      </button>
    </>
  ),
}));

jest.mock('components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('components/common/RichTextEditor/RichTextEditorPreviewerV1', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref?: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    ...rest
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={rest['data-testid']}>{children}</div>,
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
    tooltip,
    onClick,
    ...rest
  }: {
    tooltip?: string;
    onClick?: () => void;
    'data-testid'?: string;
  }) => (
    <button
      aria-label={tooltip}
      data-testid={rest['data-testid']}
      onClick={onClick}
    />
  ),
  Skeleton: () => <span data-testid="skeleton" />,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('@untitledui/icons', () => ({
  Edit01: () => <span />,
  Trash01: () => <span />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ConversationReply } from '../../../../../generated/entity/feed/conversation';
import ActivityThread from './ActivityThread';

const reply = (author: string) =>
  ({
    id: 'r1',
    author: { id: author, name: author, type: 'user' },
    message: 'a reply',
    createdAt: 1,
  } as unknown as ConversationReply);

const renderThread = (
  replies: ConversationReply[] = [reply('bob')],
  overrides: { isLoading?: boolean; focusComposer?: boolean } = {}
) => {
  const props = {
    threadId: 'T1',
    replies,
    isLoading: false,
    focusComposer: false,
    onReply: jest.fn(),
    onChanged: jest.fn(),
    ...overrides,
  };
  render(<ActivityThread {...props} />);

  return props;
};

describe('ActivityThread', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { name: 'bob' };
    mockDeleteAccess = 'conditionalAllow';
  });

  it('lists the replies above the composer, and posts through it', () => {
    const { onReply } = renderThread();

    expect(screen.getByText('a reply')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('inbox-comment-composer'));

    expect(onReply).toHaveBeenCalledWith('hello');
  });

  it('focuses the composer when opened with Reply', () => {
    renderThread([], { focusComposer: true });

    expect(screen.getByTestId('inbox-comment-composer')).toHaveAttribute(
      'data-focused',
      'true'
    );
  });

  it('shows a skeleton while the replies load', () => {
    renderThread([], { isLoading: true });

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  describe('editing', () => {
    it('lets the author edit a reply through its conversation', async () => {
      mockPatchReply.mockResolvedValue({});
      const { onChanged } = renderThread();

      fireEvent.click(screen.getByTestId('edit-message'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('save-edit'));
      });

      expect(mockPatchReply).toHaveBeenCalledWith('T1', 'r1', [
        { op: 'replace', path: '/message', value: 'edited' },
      ]);
      expect(onChanged).toHaveBeenCalled();
    });

    it('cancels the edit without saving', () => {
      renderThread();

      fireEvent.click(screen.getByTestId('edit-message'));
      fireEvent.click(screen.getByTestId('cancel-edit-message'));

      expect(screen.getByText('a reply')).toBeInTheDocument();
      expect(mockPatchReply).not.toHaveBeenCalled();
    });

    it('offers no edit on someone else’s reply', () => {
      renderThread([reply('alice')]);

      expect(screen.queryByTestId('edit-message')).not.toBeInTheDocument();
    });
  });

  describe('deleting', () => {
    it('deletes after confirming, then re-reads the thread', async () => {
      mockDeleteReply.mockResolvedValue({});
      const { onChanged } = renderThread();

      fireEvent.click(screen.getByTestId('delete-message'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('confirm-delete-message'));
      });

      expect(mockDeleteReply).toHaveBeenCalledWith('T1', 'r1');
      expect(onChanged).toHaveBeenCalled();
    });

    it('closes the confirmation and toasts once when the delete fails', async () => {
      mockDeleteReply.mockRejectedValue(new Error('403'));
      renderThread();

      fireEvent.click(screen.getByTestId('delete-message'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('confirm-delete-message'));
      });

      expect(mockShowErrorToast).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByTestId('confirm-delete-message')
      ).not.toBeInTheDocument();
    });

    // ConditionalAllow is the default isOwner() rule: authors only.
    it.each([
      [
        'the author under conditionalAllow',
        'bob',
        'conditionalAllow',
        {},
        true,
      ],
      ['a non-author under allow', 'alice', 'allow', {}, true],
      [
        'a non-author under conditionalAllow',
        'alice',
        'conditionalAllow',
        {},
        false,
      ],
      [
        'an admin, whatever the access',
        'alice',
        undefined,
        { isAdmin: true },
        true,
      ],
      ['anyone while access is unknown', 'alice', undefined, {}, false],
    ])('offers delete to %s: %s', (_, author, access, user, isShown) => {
      mockDeleteAccess = access;
      mockCurrentUser = { name: 'bob', ...user };
      renderThread([reply(author)]);

      expect(screen.queryAllByTestId('delete-message')).toHaveLength(
        isShown ? 1 : 0
      );
    });
  });

  describe('reactions', () => {
    it.each([
      ['add', 'react', mockAddReplyReaction],
      ['remove', 'unreact', mockRemoveReplyReaction],
    ])('%ss a reaction on the reply', async (_, button, api) => {
      api.mockResolvedValue({});
      const { onChanged } = renderThread();

      await act(async () => {
        fireEvent.click(screen.getByText(button));
      });

      expect(api).toHaveBeenCalledWith('T1', 'r1', 'heart');
      expect(onChanged).toHaveBeenCalled();
    });

    it('toasts when the reaction is refused', async () => {
      mockAddReplyReaction.mockRejectedValue(new Error('boom'));
      const { onChanged } = renderThread();

      await act(async () => {
        fireEvent.click(screen.getByText('react'));
      });

      expect(mockShowErrorToast).toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
    });
  });
});
