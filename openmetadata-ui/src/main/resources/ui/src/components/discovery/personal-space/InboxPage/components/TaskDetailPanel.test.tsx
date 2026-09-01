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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ComponentProps, ReactNode } from 'react';

const mockGetTaskById = jest.fn();
const mockResolveTask = jest.fn();
const mockAddComment = jest.fn();
const mockEditComment = jest.fn();
const mockDeleteComment = jest.fn();
const mockShowErrorToast = jest.fn();
const mockGetEntityPermission = jest.fn();
const mockGetResolvedTaskFormSchema = jest.fn();

let mockCurrentUser: { name?: string; isAdmin?: boolean } = { name: 'bob' };

// `TASK_ENTITY_TYPES` is built by indexing the `tasksAPI` enum mocked above, so
// stub the map directly rather than re-declaring every enum member.
jest.mock('constants/Task.constant', () => ({
  TASK_TYPES: {},
  TASK_ENTITY_TYPES: {
    RequestApproval: 'message.request-approval-message',
    GlossaryApproval: 'message.request-approval-message',
    DataAccessRequest: 'message.data-access-request-message',
  },
}));

jest.mock('rest/tasksAPI', () => ({
  getTaskById: mockGetTaskById,
  resolveTask: mockResolveTask,
  addTaskComment: (...a: unknown[]) => mockAddComment(...a),
  editTaskComment: (...a: unknown[]) => mockEditComment(...a),
  deleteTaskComment: (...a: unknown[]) => mockDeleteComment(...a),
  TaskResolutionType: {
    Approved: 'Approved',
    AutoApproved: 'AutoApproved',
    Rejected: 'Rejected',
    AutoRejected: 'AutoRejected',
  },
}));

// Boundary stub keeping the two behaviours the legacy resolve body depends on:
// approval tasks resolve to a sentinel, suggestion tasks to the applied value.
jest.mock('utils/TaskFormSchemaUtils', () => ({
  getResolvedTaskFormSchema: (...a: unknown[]) =>
    mockGetResolvedTaskFormSchema(...a),
  applyTaskFormSchemaDefaults: (payload: Record<string, unknown>) => payload,
  getEditableTaskPayload: (task: { payload?: Record<string, unknown> }) =>
    task.payload ?? {},
  getTaskFormHandlerConfig: (task: { type?: string }) =>
    task.type === 'DescriptionUpdate'
      ? { type: 'descriptionUpdate', valueField: 'newDescription' }
      : {
          type: 'approval',
          approvedValue: 'approved',
          rejectedValue: 'rejected',
        },
  getTaskResolutionNewValue: (
    _task: unknown,
    payload: Record<string, unknown>
  ) => payload.newDescription,
  shouldRequireTaskResolutionValue: () => false,
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock('context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getEntityPermission: mockGetEntityPermission,
  }),
}));

jest.mock('utils/FeedUtilsPure', () => ({
  MarkdownToHTMLConverter: { makeHtml: (m: string) => m },
  getFrontEndFormat: (m: string) => m,
}));

jest.mock('components/common/DeleteModal/DeleteModal', () => ({
  __esModule: true,
  default: ({ open, onDelete }: { open: boolean; onDelete: () => void }) =>
    open ? (
      <button data-testid="confirm-delete-task-comment" onClick={onDelete}>
        delete
      </button>
    ) : null,
}));

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: mockShowErrorToast,
}));

// Tag the fallback so tests assert the permission-aware message reaches the toast.
jest.mock('utils/StringUtils', () => ({
  ...jest.requireActual('utils/StringUtils'),
  getPermissionErrorText: jest.fn(
    (_error: unknown, fallback: string) => `perm:${fallback}`
  ),
}));

jest.mock(
  'components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: ({
      children,
      onUpdate,
    }: {
      children?: ReactNode;
      onUpdate?: (...args: unknown[]) => void;
    }) => (
      <div data-testid="user-team-picker">
        <button
          aria-label="picker-save"
          data-testid="picker-save"
          onClick={() =>
            onUpdate([
              {
                id: 'u2',
                type: 'user',
                name: 'bob',
                displayName: 'Bob',
                href: 'http://x/u2',
              },
            ])
          }
        />
        <button
          aria-label="picker-save-empty"
          data-testid="picker-save-empty"
          onClick={() => onUpdate([])}
        />
        {children}
      </div>
    ),
  })
);

// Spread the real module: the status badge pulls in `inbox.utils`, whose
// profiler constants need the day helpers at import time.
jest.mock('utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('utils/date-time/DateTimeUtils'),
  getRelativeTime: (ts: number) => `time-${ts}`,
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { name?: string }) => ref?.name ?? '',
}));

jest.mock('./TaskOverview', () => ({
  __esModule: true,
  default: () => <div data-testid="task-overview" />,
}));

jest.mock('./TaskActionCommentModal', () => ({
  __esModule: true,
  default: ({
    open,
    showRootCause,
    onConfirm,
    onCancel,
  }: {
    open?: boolean;
    showRootCause?: boolean;
    onConfirm?: (...args: unknown[]) => void;
    onCancel?: (...args: unknown[]) => void;
  }) =>
    open ? (
      <div data-testid="comment-modal">
        {showRootCause && <span data-testid="modal-root-cause" />}
        <button
          aria-label="modal-confirm"
          data-testid="modal-confirm"
          onClick={() => onConfirm({ comment: 'a comment' })}
        />
        <button
          aria-label="modal-confirm-with-root-cause"
          data-testid="modal-confirm-with-root-cause"
          onClick={() =>
            onConfirm({ comment: 'a comment', rootCause: 'FalsePositive' })
          }
        />
        <button
          aria-label="modal-cancel"
          data-testid="modal-cancel"
          onClick={onCancel}
        />
      </div>
    ) : null,
}));

jest.mock('./TaskActivityTimeline', () => ({
  __esModule: true,
  default: () => <div data-testid="task-activity-timeline" />,
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

jest.mock('components/common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock('components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('components/common/RichTextEditor/RichTextEditorPreviewerV1', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: ({
    children,
    color,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    color?: string;
    'data-testid'?: string;
  }) => (
    <span data-color={color} data-testid={testId}>
      {children}
    </span>
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
  Skeleton: () => <div data-testid="skeleton" />,
  Button: ({
    children,
    onClick,
    onPress,
    isDisabled,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    onClick?: (...args: unknown[]) => void;
    onPress?: (...args: unknown[]) => void;
    isDisabled?: boolean;
    'data-testid'?: string;
  }) => (
    <button
      data-testid={testId}
      disabled={isDisabled}
      onClick={onClick ?? onPress}>
      {children}
    </button>
  ),
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  EmptyPlaceholder: ({
    title,
    description,
  }: {
    title?: ReactNode;
    description?: ReactNode;
  }) => (
    <div>
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
  Tabs: Object.assign(
    ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    {
      List: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Item: ({ label }: { label?: ReactNode }) => <span>{label}</span>,
      Panel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    }
  ),
}));

jest.mock('@untitledui/icons', () => ({
  CheckCircle: () => <span>check</span>,
  XCircle: () => <span>x</span>,
  Edit01: (props: ComponentProps<'span'>) => <span {...props} />,
  Trash01: (props: ComponentProps<'span'>) => <span {...props} />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-router-dom', () => ({
  Link: ({
    children,
    to,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    to?: string;
    'data-testid'?: string;
  }) => (
    <a data-testid={testId} href={to}>
      {children}
    </a>
  ),
}));

jest.mock('utils/TaskNavigationUtils', () => ({
  getTaskDetailPathFromTask: (task: {
    about?: { type?: string; fullyQualifiedName?: string };
  }) =>
    `/${task.about?.type}/${task.about?.fullyQualifiedName}/activity_feed/tasks`,
}));

jest.mock('utils/RouterUtils', () => ({
  getTestCaseDetailPagePath: (fqn: string, tab: string) =>
    `/test-case/${fqn}/${tab}`,
}));

// Boundary stub: the real chip renders the OSS user popover.
jest.mock('enums/entity.enum', () => ({
  EntityType: { TEST_CASE: 'testCase' },
  EntityTabs: { ACTIVITY_FEED: 'activity_feed' },
}));

jest.mock(
  'components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface',
  () => ({
    ActivityFeedTabs: { TASKS: 'tasks' },
  })
);

jest.mock('pages/IncidentManager/IncidentManager.interface', () => ({
  TestCasePageTabs: { ISSUES: 'issues' },
}));

import TaskDetailPanel from './TaskDetailPanel';

const TASK = {
  id: 'task-1',
  taskId: '42',
  name: 'DAR-001',
  displayName: 'Access to Sales Table',
  status: 'Open',
  createdAt: 1000,
  createdBy: { id: 'u1', name: 'alice' },
  availableTransitions: [
    { id: 'approve', label: 'label.approve', resolutionType: 'Approved' },
    { id: 'reject', label: 'label.reject', resolutionType: 'Rejected' },
  ],
  comments: [],
};

const TASK_WITH_COMMENT = {
  ...TASK,
  comments: [
    { id: 'c1', author: { name: 'bob' }, createdAt: 1, message: 'hi' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = { name: 'bob' };
  mockGetTaskById.mockResolvedValue({ data: TASK });
  mockGetEntityPermission.mockResolvedValue({ ResolveTask: true });
  mockGetResolvedTaskFormSchema.mockResolvedValue(undefined);
});

describe('TaskDetailPanel', () => {
  it('renders the task header after loading', async () => {
    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    expect(screen.getByText('Access to Sales Table')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
  });

  it('falls back to the description when the name is only the taskId', async () => {
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        displayName: undefined,
        name: '42',
        description: 'Approval required for sales_table',
      },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    expect(screen.getByText('#42')).toBeInTheDocument();
    // The bare id never doubles as the heading.
    expect(screen.queryByText('42')).not.toBeInTheDocument();
    expect(
      screen.getAllByText('Approval required for sales_table').length
    ).toBeGreaterThan(0);
  });

  it('fetches the task with the full field set', async () => {
    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    expect(mockGetTaskById).toHaveBeenCalledWith('task-1', {
      fields:
        'about,createdBy,reviewers,assignees,resolution,approvedBy,approvedAt,availableTransitions,payload,comments',
    });
  });

  it('resolves the task and notifies on Approve', async () => {
    const onResolved = jest.fn();
    mockResolveTask.mockResolvedValue({ ...TASK, status: 'Approved' });

    await act(async () =>
      render(<TaskDetailPanel taskId="task-1" onResolved={onResolved} />)
    );

    await act(async () => {
      fireEvent.click(screen.getByText('label.approve'));
    });

    expect(mockResolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'approve',
      resolutionType: 'Approved',
    });
    expect(onResolved).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Approved' })
    );
  });

  it('hides the action buttons after a transition is fired', async () => {
    // The workflow advances async, so the just-used transition must not stay
    // clickable — re-submitting it hits a workflow with no active task (500).
    mockResolveTask.mockResolvedValue({ ...TASK, status: 'Approved' });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    expect(screen.getByText('label.approve')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('label.approve'));
    });

    expect(screen.queryByText('label.approve')).not.toBeInTheDocument();
    expect(screen.queryByText('label.reject')).not.toBeInTheDocument();
  });

  it('shows the next stage actions once the workflow advances, without a reload', async () => {
    // Approve → the workflow moves the DAR to "awaiting grant". The panel polls
    // until the consumed transition is gone, then renders Mark as granted.
    jest.useFakeTimers();
    mockResolveTask.mockResolvedValue({ ...TASK, status: 'Approved' });
    mockGetTaskById
      // Initial load, then one poll that still echoes the consumed transition.
      .mockResolvedValueOnce({ data: TASK })
      .mockResolvedValueOnce({ data: TASK })
      .mockResolvedValue({
        data: {
          ...TASK,
          status: 'Approved',
          availableTransitions: [
            {
              id: 'markAsGranted',
              label: 'Mark as granted',
              resolutionType: 'Granted',
            },
          ],
        },
      });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    await act(async () => {
      fireEvent.click(screen.getByText('label.approve'));
    });

    // Actions stay hidden while the workflow is still echoing `approve`.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('Mark as granted')).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.getByText('Mark as granted')).toBeInTheDocument();
    expect(screen.queryByText('label.approve')).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  it('keeps a consumed transition hidden when the workflow never advances', async () => {
    // The poll gives up after its attempts; re-firing the consumed transition
    // would hit a workflow with no active task (500), so it must stay hidden.
    jest.useFakeTimers();
    mockResolveTask.mockResolvedValue({ ...TASK, status: 'Approved' });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    await act(async () => {
      fireEvent.click(screen.getByText('label.approve'));
    });

    // One tick per poll attempt (the intervals back off), so each re-read
    // settles before the next timer fires.
    for (let attempt = 0; attempt < 7; attempt++) {
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });
    }

    expect(screen.queryByText('label.approve')).not.toBeInTheDocument();
    // The untouched transition comes back once the sync window closes.
    expect(screen.getByText('label.reject')).toBeInTheDocument();

    jest.useRealTimers();
  });

  it('resolves the task and notifies on Reject', async () => {
    const onResolved = jest.fn();
    mockResolveTask.mockResolvedValue({ ...TASK, status: 'Rejected' });

    await act(async () =>
      render(<TaskDetailPanel taskId="task-1" onResolved={onResolved} />)
    );

    await act(async () => {
      fireEvent.click(screen.getByText('label.reject'));
    });

    expect(mockResolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'reject',
      resolutionType: 'Rejected',
    });
    expect(onResolved).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Rejected' })
    );
  });

  it('runs a non-approve/reject transition (e.g. Revoke) with its id and type', async () => {
    const onResolved = jest.fn();
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        availableTransitions: [
          { id: 'revoke', label: 'Revoke access', resolutionType: 'Revoked' },
        ],
      },
    });
    mockResolveTask.mockResolvedValue({ ...TASK, status: 'Closed' });

    await act(async () =>
      render(<TaskDetailPanel taskId="task-1" onResolved={onResolved} />)
    );

    // Non-approve/reject transitions get a stable `task-transition-<id>` testid
    // so e2e can target them (approve/reject keep their dedicated testids).
    const revokeButton = screen.getByTestId('task-transition-revoke');

    expect(revokeButton).toHaveTextContent('Revoke access');

    await act(async () => {
      fireEvent.click(revokeButton);
    });

    expect(mockResolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'revoke',
      resolutionType: 'Revoked',
    });
    expect(onResolved).toHaveBeenCalled();
  });

  it('falls back to default Approve/Reject actions when the task offers none', async () => {
    mockGetTaskById.mockResolvedValue({
      data: { ...TASK, availableTransitions: [] },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    expect(screen.getByText('label.approve')).toBeInTheDocument();
    expect(screen.getByText('label.reject')).toBeInTheDocument();
  });

  it('shows no action buttons for a closed/terminal task', async () => {
    // Terminal status with no server transitions must not fabricate approve/reject.
    mockGetTaskById.mockResolvedValue({
      data: { ...TASK, status: 'Rejected', availableTransitions: [] },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    expect(screen.queryByText('label.approve')).not.toBeInTheDocument();
    expect(screen.queryByText('label.reject')).not.toBeInTheDocument();
  });

  it('disables the other action while a transition is in flight', async () => {
    // A never-settling resolve keeps the panel in the loading state.
    mockResolveTask.mockReturnValue(new Promise(() => undefined));

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    await act(async () => {
      fireEvent.click(screen.getByText('label.approve'));
    });

    // Approve is busy, so Reject must be disabled to prevent a double action.
    expect(screen.getByText('label.reject').closest('button')).toBeDisabled();
  });

  it('shows an error toast when resolve fails', async () => {
    const err = new Error('boom');
    mockResolveTask.mockRejectedValue(err);

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    await act(async () => {
      fireEvent.click(screen.getByText('label.reject'));
    });

    // Fallback routed through getPermissionErrorText (tagged 'perm:' by the mock).
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      err,
      'perm:message.something-went-wrong'
    );
  });

  it('shows an error toast and no-data when the task fails to load', async () => {
    mockGetTaskById.mockRejectedValue(new Error('nope'));

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    expect(mockShowErrorToast).toHaveBeenCalled();
    expect(screen.getByText('label.no-task-found')).toBeInTheDocument();
  });

  it('opens the assignee picker for a reassign transition instead of firing', async () => {
    const onTaskUpdated = jest.fn();
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        availableTransitions: [
          {
            id: 'reassign',
            label: 'Reassign',
            targetStageId: 'assigned',
            targetTaskStatus: 'InProgress',
          },
        ],
      },
    });
    mockResolveTask.mockResolvedValue({ ...TASK, status: 'InProgress' });

    await act(async () =>
      render(<TaskDetailPanel taskId="task-1" onTaskUpdated={onTaskUpdated} />)
    );

    // The button is wrapped in the picker; clicking it must not fire the API.
    await act(async () => {
      fireEvent.click(screen.getByTestId('task-transition-reassign'));
    });

    expect(mockResolveTask).not.toHaveBeenCalled();

    // Picking an assignee fires the transition with the payload.
    await act(async () => {
      fireEvent.click(screen.getByTestId('picker-save'));
    });

    expect(mockResolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'reassign',
      resolutionType: undefined,
      payload: {
        assignees: [
          { id: 'u2', type: 'user', name: 'bob', displayName: 'Bob' },
        ],
      },
    });
    // Assignee changes notify onTaskUpdated so the list re-syncs visibility.
    expect(onTaskUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'InProgress' })
    );
  });

  it('does not fire an assign transition when the picker selection is empty', async () => {
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        availableTransitions: [
          { id: 'assign', label: 'Assign', targetStageId: 'assigned' },
        ],
      },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    await act(async () => {
      fireEvent.click(screen.getByTestId('picker-save-empty'));
    });

    expect(mockResolveTask).not.toHaveBeenCalled();
    // Empty selection (toggling the current assignee off) surfaces feedback
    // rather than silently no-op'ing.
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      'message.field-text-is-required'
    );
  });

  it('collects a comment before firing a requiresComment transition', async () => {
    const onResolved = jest.fn();
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        availableTransitions: [
          {
            id: 'approve',
            label: 'label.approve',
            resolutionType: 'Approved',
            requiresComment: true,
          },
        ],
      },
    });
    mockResolveTask.mockResolvedValue({ ...TASK, status: 'Approved' });

    await act(async () =>
      render(<TaskDetailPanel taskId="task-1" onResolved={onResolved} />)
    );

    await act(async () => {
      fireEvent.click(screen.getByText('label.approve'));
    });

    // The transition must not fire until the comment is collected.
    expect(mockResolveTask).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('modal-confirm'));
    });

    expect(mockResolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'approve',
      resolutionType: 'Approved',
      comment: 'a comment',
    });
    expect(onResolved).toHaveBeenCalled();
  });

  it('sends the root cause as testCaseFailureReason for an incident resolve', async () => {
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        category: 'Incident',
        availableTransitions: [
          {
            id: 'resolve',
            label: 'Resolve',
            resolutionType: 'Completed',
            requiresComment: true,
          },
        ],
      },
    });
    mockResolveTask.mockResolvedValue({ ...TASK, status: 'Completed' });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    await act(async () => {
      fireEvent.click(screen.getByText('Resolve'));
    });

    // Incident tasks surface the Root Cause select in the modal.
    expect(screen.getByTestId('modal-root-cause')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('modal-confirm-with-root-cause'));
    });

    expect(mockResolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'resolve',
      resolutionType: 'Completed',
      comment: 'a comment',
      payload: { testCaseFailureReason: 'FalsePositive' },
    });
  });

  it('does not surface the root cause select for non-incident tasks', async () => {
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        category: 'Approval',
        availableTransitions: [
          {
            id: 'approve',
            label: 'label.approve',
            resolutionType: 'Approved',
            requiresComment: true,
          },
        ],
      },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    await act(async () => {
      fireEvent.click(screen.getByText('label.approve'));
    });

    expect(screen.queryByTestId('modal-root-cause')).not.toBeInTheDocument();
  });

  it('cancelling the comment modal fires nothing', async () => {
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        availableTransitions: [
          {
            id: 'approve',
            label: 'label.approve',
            resolutionType: 'Approved',
            requiresComment: true,
          },
        ],
      },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    await act(async () => {
      fireEvent.click(screen.getByText('label.approve'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('modal-cancel'));
    });

    expect(mockResolveTask).not.toHaveBeenCalled();
    expect(screen.queryByTestId('comment-modal')).not.toBeInTheDocument();
  });

  it('links only the asset name within the title', async () => {
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        about: {
          id: 'e1',
          type: 'table',
          name: 'Sales Table',
          fullyQualifiedName: 'svc.db.schema.sales',
        },
      },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    const link = screen.getByTestId('task-about-link');

    expect(link).toHaveAttribute(
      'href',
      '/table/svc.db.schema.sales/activity_feed/tasks'
    );
    expect(link).toHaveTextContent('Sales Table');
  });

  it('highlights the whole trailing token when the asset name has a suffix', async () => {
    // The asset name is a prefix of the trailing token; the entire token is
    // highlighted, never a half-coloured word.
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        displayName: 'Request Access to dim_address_clean_changed',
        about: {
          id: 'e2',
          type: 'table',
          name: 'dim_address_clean',
          fullyQualifiedName: 'svc.db.schema.dim_address_clean',
        },
      },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    const link = screen.getByTestId('task-about-link');

    expect(link.textContent).toBe('dim_address_clean_changed');
    expect(link).toHaveAttribute(
      'href',
      '/table/svc.db.schema.dim_address_clean/activity_feed/tasks'
    );
  });

  it('links the test case for an incident task with no about, derived from the description', async () => {
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        displayName:
          'Test Case Incident - comments_table_column_count_to_equal_scby',
        category: 'Incident',
        about: undefined,
        description:
          'New incident for test case: mysql_sample.default.posts_db.Comments.comments_table_column_count_to_equal_scby',
      },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    const link = screen.getByTestId('task-about-link');

    expect(link).toHaveAttribute(
      'href',
      '/test-case/mysql_sample.default.posts_db.Comments.comments_table_column_count_to_equal_scby/issues'
    );
    expect(link.textContent).toBe('comments_table_column_count_to_equal_scby');
  });

  it('renders a plain title when the task has no about reference', async () => {
    mockGetTaskById.mockResolvedValue({
      data: { ...TASK, about: undefined },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    expect(screen.queryByTestId('task-about-link')).not.toBeInTheDocument();
    expect(screen.getByText('Access to Sales Table')).toBeInTheDocument();
  });

  it('links the whole title when the asset name is only a substring, not a trailing token', async () => {
    // A glossary term named "1" must not link the "1" inside "TASK-19586".
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        displayName: 'TASK-19586',
        about: {
          id: 'g1',
          type: 'glossaryTerm',
          name: '1',
          fullyQualifiedName: 'TeamGlow.1',
        },
      },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    const link = screen.getByTestId('task-about-link');

    expect(link).toHaveAttribute(
      'href',
      '/glossaryTerm/TeamGlow.1/activity_feed/tasks'
    );
    expect(link).toHaveTextContent('TASK-19586');
    expect(screen.queryByText('(glossaryTerm)')).not.toBeInTheDocument();
  });

  it('lets the author edit a task comment', async () => {
    mockGetTaskById.mockResolvedValue({ data: TASK_WITH_COMMENT });
    mockEditComment.mockResolvedValue({});

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    fireEvent.mouseEnter(screen.getByTestId('task-comment-card'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-task-comment'));
    });
    const editBox = screen.getByTestId('edit-task-comment-editor');
    await act(async () => {
      fireEvent.click(within(editBox).getByTestId('comment-editor'));
    });

    expect(mockEditComment).toHaveBeenCalledWith('task-1', 'c1', 'edited');
    // Reload after edit (initial load + reload = 2 calls).
    expect(mockGetTaskById).toHaveBeenCalledTimes(2);
  });

  it('cancels a task comment edit without saving', async () => {
    mockGetTaskById.mockResolvedValue({ data: TASK_WITH_COMMENT });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    fireEvent.mouseEnter(screen.getByTestId('task-comment-card'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-task-comment'));
    });

    expect(screen.getByTestId('edit-task-comment-editor')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel-edit-task-comment'));
    });

    expect(
      screen.queryByTestId('edit-task-comment-editor')
    ).not.toBeInTheDocument();
    expect(mockEditComment).not.toHaveBeenCalled();
  });

  it('lets the author delete a task comment after confirming', async () => {
    mockGetTaskById.mockResolvedValue({ data: TASK_WITH_COMMENT });
    mockDeleteComment.mockResolvedValue({});

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    fireEvent.mouseEnter(screen.getByTestId('task-comment-card'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-task-comment'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-task-comment'));
    });

    expect(mockDeleteComment).toHaveBeenCalledWith('task-1', 'c1');
    expect(mockGetTaskById).toHaveBeenCalledTimes(2);
  });

  it('shows only delete for an admin who is not the comment author', async () => {
    mockCurrentUser = { name: 'carol', isAdmin: true };
    mockGetTaskById.mockResolvedValue({ data: TASK_WITH_COMMENT });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    fireEvent.mouseEnter(screen.getByTestId('task-comment-card'));

    expect(screen.queryByTestId('edit-task-comment')).not.toBeInTheDocument();
    expect(screen.getByTestId('delete-task-comment')).toBeInTheDocument();
  });

  it('shows no comment actions for a non-author non-admin', async () => {
    mockCurrentUser = { name: 'carol' };
    mockGetTaskById.mockResolvedValue({ data: TASK_WITH_COMMENT });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    fireEvent.mouseEnter(screen.getByTestId('task-comment-card'));

    expect(screen.queryByTestId('edit-task-comment')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-task-comment')).not.toBeInTheDocument();
  });

  it('shows no comment actions when neither the author nor the current user is named', async () => {
    mockCurrentUser = {};
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        comments: [{ id: 'c2', author: {}, createdAt: 1, message: 'x' }],
      },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    fireEvent.mouseEnter(screen.getByTestId('task-comment-card'));

    expect(screen.queryByTestId('edit-task-comment')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-task-comment')).not.toBeInTheDocument();
  });

  it('renders comments newest-first', async () => {
    mockGetTaskById.mockResolvedValue({
      data: {
        ...TASK,
        comments: [
          { id: 'c1', author: { name: 'older' }, createdAt: 100, message: 'a' },
          { id: 'c2', author: { name: 'newer' }, createdAt: 200, message: 'b' },
        ],
      },
    });

    await act(async () => render(<TaskDetailPanel taskId="task-1" />));

    const cards = screen.getAllByTestId('task-comment-card');

    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('newer');
    expect(cards[1]).toHaveTextContent('older');
  });

  describe('ResolveTask permission gate (self-approval guard)', () => {
    const DAR_TASK = { ...TASK, type: 'DataAccessRequest' };

    it('hides Approve/Reject on a DAR task when ResolveTask is denied (self-approval)', async () => {
      mockGetTaskById.mockResolvedValue({ data: DAR_TASK });
      mockGetEntityPermission.mockResolvedValue({ ResolveTask: false });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));

      expect(mockGetEntityPermission).toHaveBeenCalledWith('task', 'task-1');
      expect(screen.queryByText('label.approve')).not.toBeInTheDocument();
      expect(screen.queryByText('label.reject')).not.toBeInTheDocument();
    });

    it('fails closed: hides Approve/Reject on a DAR task while the permission is still resolving', async () => {
      mockGetTaskById.mockResolvedValue({ data: DAR_TASK });
      // A never-settling permission fetch keeps canResolveTask at its default.
      mockGetEntityPermission.mockReturnValue(new Promise(() => undefined));

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));

      expect(screen.queryByText('label.approve')).not.toBeInTheDocument();
      expect(screen.queryByText('label.reject')).not.toBeInTheDocument();
    });

    it('shows Approve/Reject on a DAR task when ResolveTask is allowed', async () => {
      mockGetTaskById.mockResolvedValue({ data: DAR_TASK });
      mockGetEntityPermission.mockResolvedValue({ ResolveTask: true });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));

      expect(screen.getByText('label.approve')).toBeInTheDocument();
      expect(screen.getByText('label.reject')).toBeInTheDocument();
    });

    it('keeps a reassign transition on a DAR task even when ResolveTask is denied (gated by EditTask, not ResolveTask)', async () => {
      mockGetTaskById.mockResolvedValue({
        data: {
          ...DAR_TASK,
          availableTransitions: [
            { id: 'reassign', label: 'Reassign', targetStageId: 'assigned' },
            {
              id: 'approve',
              label: 'label.approve',
              resolutionType: 'Approved',
            },
          ],
        },
      });
      mockGetEntityPermission.mockResolvedValue({ ResolveTask: false });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));

      expect(
        screen.getByTestId('task-transition-reassign')
      ).toBeInTheDocument();
      expect(screen.queryByText('label.approve')).not.toBeInTheDocument();
    });

    it('does not gate a non-DAR task on ResolveTask and skips the permission fetch', async () => {
      mockGetTaskById.mockResolvedValue({ data: TASK });
      mockGetEntityPermission.mockResolvedValue({ ResolveTask: false });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));

      expect(mockGetEntityPermission).not.toHaveBeenCalled();
      expect(screen.getByText('label.approve')).toBeInTheDocument();
      expect(screen.getByText('label.reject')).toBeInTheDocument();
    });
  });

  describe('status badge', () => {
    it('renders the status beside the task id', async () => {
      await act(async () => render(<TaskDetailPanel taskId="task-1" />));

      const badge = screen.getByTestId('task-status-badge');

      expect(badge).toHaveTextContent('label.open');
      expect(badge).toHaveAttribute('data-color', 'warning');
    });

    it('tones a rejected task red', async () => {
      mockGetTaskById.mockResolvedValue({
        data: { ...TASK, status: 'Rejected', availableTransitions: [] },
      });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));

      const badge = screen.getByTestId('task-status-badge');

      expect(badge).toHaveTextContent('label.rejected');
      expect(badge).toHaveAttribute('data-color', 'error');
    });

    it('tones a granted request green', async () => {
      mockGetTaskById.mockResolvedValue({
        data: { ...TASK, status: 'Granted', availableTransitions: [] },
      });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));

      expect(screen.getByTestId('task-status-badge')).toHaveAttribute(
        'data-color',
        'success'
      );
    });
  });

  describe('legacy (non-workflow) tasks', () => {
    // No availableTransitions, so there is no transition id to name: the server
    // 400s on a fabricated one and the body must carry resolutionType + newValue.
    const LEGACY_APPROVAL_TASK = {
      ...TASK,
      type: 'RequestApproval',
      category: 'Approval',
      availableTransitions: [],
      payload: { proposedChanges: { owners: { added: ['bob'] } } },
    };

    it('resolves an approve without a transitionId, carrying newValue and the payload', async () => {
      mockGetTaskById.mockResolvedValue({ data: LEGACY_APPROVAL_TASK });
      mockResolveTask.mockResolvedValue({
        ...LEGACY_APPROVAL_TASK,
        status: 'Approved',
      });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));
      await act(async () => {
        fireEvent.click(screen.getByTestId('task-approve'));
      });

      expect(mockResolveTask).toHaveBeenCalledWith('task-1', {
        resolutionType: 'Approved',
        newValue: 'approved',
        payload: { proposedChanges: { owners: { added: ['bob'] } } },
      });
    });

    it('resolves a reject with the rejected sentinel and no payload', async () => {
      mockGetTaskById.mockResolvedValue({ data: LEGACY_APPROVAL_TASK });
      mockResolveTask.mockResolvedValue({
        ...LEGACY_APPROVAL_TASK,
        status: 'Rejected',
      });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));
      await act(async () => {
        fireEvent.click(screen.getByTestId('task-reject'));
      });

      expect(mockResolveTask).toHaveBeenCalledWith('task-1', {
        resolutionType: 'Rejected',
        newValue: 'rejected',
      });
    });

    it('applies the suggested value for a description task', async () => {
      mockGetTaskById.mockResolvedValue({
        data: {
          ...TASK,
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          availableTransitions: [],
          payload: { fieldPath: 'description', newDescription: 'the new one' },
        },
      });
      mockResolveTask.mockResolvedValue({ ...TASK, status: 'Approved' });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));
      await act(async () => {
        fireEvent.click(screen.getByTestId('task-approve'));
      });

      expect(mockResolveTask).toHaveBeenCalledWith('task-1', {
        resolutionType: 'Approved',
        newValue: 'the new one',
        payload: { fieldPath: 'description', newDescription: 'the new one' },
      });
    });

    it('resolves the form schema for a legacy task only', async () => {
      mockGetTaskById.mockResolvedValue({ data: LEGACY_APPROVAL_TASK });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));

      expect(mockGetResolvedTaskFormSchema).toHaveBeenCalledWith(
        'RequestApproval',
        'Approval'
      );
    });

    it('skips the form schema fetch for a workflow-driven task', async () => {
      await act(async () => render(<TaskDetailPanel taskId="task-1" />));

      expect(mockGetResolvedTaskFormSchema).not.toHaveBeenCalled();
    });

    it('does not poll for a consumed transition after a legacy resolve', async () => {
      mockGetTaskById.mockResolvedValue({ data: LEGACY_APPROVAL_TASK });
      mockResolveTask.mockResolvedValue({
        ...LEGACY_APPROVAL_TASK,
        status: 'Approved',
      });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));
      await act(async () => {
        fireEvent.click(screen.getByTestId('task-approve'));
      });

      // A legacy resolve is synchronous, so only the initial load hits the API.
      expect(mockGetTaskById).toHaveBeenCalledTimes(1);
    });

    it('offers no generic approve/reject on an incident without transitions', async () => {
      // Incidents need transitionId 'resolve' + Completed + a root cause.
      mockGetTaskById.mockResolvedValue({
        data: {
          ...TASK,
          type: 'TestCaseResolution',
          category: 'Incident',
          availableTransitions: [],
        },
      });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));

      expect(screen.queryByTestId('task-approve')).not.toBeInTheDocument();
      expect(screen.queryByTestId('task-reject')).not.toBeInTheDocument();
    });

    it('keeps the incident resolve transition when the workflow provides one', async () => {
      mockGetTaskById.mockResolvedValue({
        data: {
          ...TASK,
          type: 'TestCaseResolution',
          category: 'Incident',
          availableTransitions: [
            {
              id: 'resolve',
              label: 'Resolve',
              requiresComment: true,
              resolutionType: 'Completed',
            },
          ],
        },
      });
      mockResolveTask.mockResolvedValue({ ...TASK, status: 'Completed' });

      await act(async () => render(<TaskDetailPanel taskId="task-1" />));
      fireEvent.click(screen.getByTestId('task-transition-resolve'));

      // The modal also collects the root cause, stored as testCaseFailureReason.
      expect(screen.getByTestId('modal-root-cause')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId('modal-confirm-with-root-cause'));
      });

      expect(mockResolveTask).toHaveBeenCalledWith('task-1', {
        transitionId: 'resolve',
        resolutionType: 'Completed',
        comment: 'a comment',
        payload: { testCaseFailureReason: 'FalsePositive' },
      });
    });
  });
});
