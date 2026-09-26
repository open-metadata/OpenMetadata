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
import { ComponentProps, ReactNode } from 'react';

const mockEditComment = jest.fn();
const mockDeleteComment = jest.fn();
const mockShowErrorToast = jest.fn();

let mockCurrentUser: { name?: string; isAdmin?: boolean } = { name: 'bob' };

jest.mock('rest/tasksAPI', () => ({
  editTaskComment: (...a: unknown[]) => mockEditComment(...a),
  deleteTaskComment: (...a: unknown[]) => mockDeleteComment(...a),
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: mockShowErrorToast,
}));

jest.mock('utils/TaskCommentUtils', () => ({
  resolveCommentPermissions: jest.requireActual('utils/TaskCommentUtils')
    .resolveCommentPermissions,
}));

jest.mock('utils/FeedUtilsPure', () => ({
  MarkdownToHTMLConverter: { makeHtml: (m: string) => m },
  getFrontEndFormat: (m: string) => m,
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

jest.mock('../inbox.utils', () => ({
  formatInboxDateTime: (ts?: number) => `at-${ts}`,
}));

jest.mock('components/common/RichTextEditor/RichTextEditorPreviewerV1', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown?: string }) => <div>{markdown}</div>,
}));

jest.mock(
  'components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew',
  () => ({
    __esModule: true,
    default: ({ onSave }: { onSave?: (m: string) => void }) => (
      <button data-testid="comment-editor" onClick={() => onSave?.('edited')}>
        editor
      </button>
    ),
  })
);

jest.mock('components/common/DeleteModal/DeleteModal', () => ({
  __esModule: true,
  default: ({ open, onDelete }: { open: boolean; onDelete: () => void }) =>
    open ? (
      <button data-testid="confirm-delete-task-comment" onClick={onDelete}>
        delete
      </button>
    ) : null,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: ({ children }: { children?: ReactNode }) => (
    <span data-testid="own-comment-chip">{children}</span>
  ),
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
    'data-testid': testId,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    'data-testid'?: string;
  }) => (
    <button data-testid={testId} onClick={onPress}>
      {children}
    </button>
  ),
  // Real <button> so the suite exercises the affordance the app ships: present
  // regardless of hover, named from its tooltip, keyboard-operable.
  ButtonUtility: ({
    'data-testid': testId,
    tooltip,
    onClick,
  }: {
    'data-testid'?: string;
    tooltip?: string;
    onClick?: () => void;
  }) => (
    <button
      aria-label={tooltip}
      data-testid={testId}
      type="button"
      onClick={onClick}>
      {tooltip}
    </button>
  ),
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock(
  '@untitledui/icons',
  () =>
    new Proxy(
      {},
      {
        get: (_target, name: string) =>
          name === '__esModule'
            ? false
            : (props: ComponentProps<'span'>) => <span {...props} />,
      }
    )
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { TaskComment } from '../../../../../rest/tasksAPI';
import TaskCommentRow from './TaskCommentRow';

const COMMENT = {
  id: 'c1',
  author: { name: 'bob', displayName: 'Bob' },
  createdAt: 10,
  message: 'looks right to me',
} as unknown as TaskComment;

const onChanged = jest.fn();

const renderRow = (comment: TaskComment = COMMENT) =>
  render(
    <TaskCommentRow comment={comment} taskId="task-1" onChanged={onChanged} />
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = { name: 'bob' };
});

describe('TaskCommentRow', () => {
  // Unmounting the actions until hover would put them out of reach of the
  // keyboard; they stay mounted and are revealed with opacity instead.
  it('keeps the actions mounted without hovering', () => {
    renderRow();

    expect(screen.getByTestId('task-comment-actions')).toBeInTheDocument();
    expect(screen.getByTestId('edit-task-comment')).toBeInTheDocument();
  });

  it('renders the author, timestamp and message', () => {
    renderRow();

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('at-10')).toBeInTheDocument();
    expect(screen.getByText('looks right to me')).toBeInTheDocument();
  });

  it('flags the viewer their own comment', () => {
    renderRow();

    expect(screen.getByTestId('own-comment-chip')).toHaveTextContent(
      'label.you'
    );
  });

  it('does not flag someone else as the viewer', () => {
    mockCurrentUser = { name: 'alice' };
    renderRow();

    expect(screen.queryByTestId('own-comment-chip')).not.toBeInTheDocument();
  });

  it('lets the author edit their comment', async () => {
    mockEditComment.mockResolvedValue({});
    renderRow();

    fireEvent.click(screen.getByTestId('edit-task-comment'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('comment-editor'));
    });

    expect(mockEditComment).toHaveBeenCalledWith('task-1', 'c1', 'edited');
    expect(onChanged).toHaveBeenCalled();
  });

  it('cancels an edit without saving', () => {
    renderRow();

    fireEvent.click(screen.getByTestId('edit-task-comment'));
    fireEvent.click(screen.getByTestId('cancel-edit-task-comment'));

    expect(screen.queryByTestId('edit-task-comment-editor')).toBeNull();
    expect(mockEditComment).not.toHaveBeenCalled();
  });

  it('surfaces a failed edit instead of closing the editor', async () => {
    mockEditComment.mockRejectedValue(new Error('nope'));
    renderRow();

    fireEvent.click(screen.getByTestId('edit-task-comment'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('comment-editor'));
    });

    expect(mockShowErrorToast).toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('deletes the comment only after the confirmation', async () => {
    mockDeleteComment.mockResolvedValue({});
    renderRow();

    fireEvent.click(screen.getByTestId('delete-task-comment'));

    expect(mockDeleteComment).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-task-comment'));
    });

    expect(mockDeleteComment).toHaveBeenCalledWith('task-1', 'c1');
    expect(onChanged).toHaveBeenCalled();
  });

  it('offers an admin delete, but not edit, on a comment they did not write', () => {
    mockCurrentUser = { name: 'admin', isAdmin: true };
    renderRow();

    expect(screen.getByTestId('delete-task-comment')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-task-comment')).not.toBeInTheDocument();
  });

  it('offers nothing to a non-author, non-admin viewer', () => {
    mockCurrentUser = { name: 'carol' };
    renderRow();

    expect(
      screen.queryByTestId('task-comment-actions')
    ).not.toBeInTheDocument();
  });

  // An unnamed viewer must not inherit the author's rights by both being blank.
  it('offers nothing when neither the viewer nor the author is named', () => {
    mockCurrentUser = {};
    renderRow({ ...COMMENT, author: {} } as unknown as TaskComment);

    expect(
      screen.queryByTestId('task-comment-actions')
    ).not.toBeInTheDocument();
  });
});
