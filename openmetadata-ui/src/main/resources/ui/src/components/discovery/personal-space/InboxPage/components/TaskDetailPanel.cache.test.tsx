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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ComponentProps, ComponentType, ReactNode } from 'react';
import { Task } from '../../../../../generated/entity/tasks/task';
import {
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../../generated/tests/testCaseResolutionStatus';
import { runQueryNotificationsSynchronously } from '../../../../../test/unit/test-utils';

jest.mock('../../../../../rest/axiosClient', () => ({ get: jest.fn() }));
runQueryNotificationsSynchronously();

jest.mock('./ClampedText', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const mockGetTaskById = jest.fn();
const mockResolveTask = jest.fn();
const mockAddComment = jest.fn();
const mockGetIncidents = jest.fn();
const mockGetTestCaseByFqn = jest.fn();
const mockGetTable = jest.fn();
const mockShowErrorToast = jest.fn();
const mockGetEntityPermission = jest.fn();
const mockGetResolvedTaskFormSchema = jest.fn();

let mockCurrentUser: {
  id?: string;
  name?: string;
  isAdmin?: boolean;
  teams?: { id: string; type: string }[];
} = { name: 'bob' };

jest.mock('constants/Task.constant', () => ({
  INCIDENT_TASK_TYPES: new Set(['IncidentResolution', 'TestCaseResolution']),
  TASK_ENTITY_TYPES: {
    RequestApproval: 'message.request-approval-message',
    GlossaryApproval: 'message.request-approval-message',
    DataAccessRequest: 'message.data-access-request-message',
  },
}));

jest.mock('rest/tasksAPI', () => ({
  TaskEntityStatus: jest.requireActual('generated/entity/tasks/task')
    .TaskStatus,
  TaskEntityType: jest.requireActual('generated/entity/tasks/task').TaskType,
  getTask: (...args: unknown[]) => mockGetTaskById(...args),
  resolveTask: (...args: unknown[]) => mockResolveTask(...args),
  addTaskComment: (...a: unknown[]) => mockAddComment(...a),
  TaskResolutionType: {
    Approved: 'Approved',
    AutoApproved: 'AutoApproved',
    Rejected: 'Rejected',
    AutoRejected: 'AutoRejected',
  },
}));

jest.mock('rest/testAPI', () => ({
  getTestCaseByFqn: (...args: unknown[]) => mockGetTestCaseByFqn(...args),
}));

jest.mock('rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentByStateId: (...args: unknown[]) =>
    mockGetIncidents(...args),
}));

jest.mock('rest/tableAPI', () => ({
  getTableDetailsByFQN: (...args: unknown[]) => mockGetTable(...args),
}));

jest.mock('rest/lineageAPI', () => ({
  getLineageByEntityCount: jest.fn(),
}));

jest.mock('utils/EntityByFqnUtils', () => ({
  getEntityByFqnUtil: jest.fn(),
}));

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
  getTaskTransitionFormSchema: () => undefined,
  getTaskTransitionUiSchema: () => undefined,
  hasRequiredTaskFormFields: () => false,
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
  getFeedChangeFieldLabel: () => undefined,
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
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
}));

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
      onUpdate: (...args: unknown[]) => void;
    }) => (
      <div data-testid="user-team-picker">
        <button
          aria-label="picker-save"
          data-testid="picker-save"
          onClick={() => onUpdate([])}
        />
        {children}
      </div>
    ),
  })
);

jest.mock('utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('utils/date-time/DateTimeUtils'),
  getRelativeTime: (ts: number) => `time-${ts}`,
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { name?: string }) => ref?.name ?? '',
}));

const mockGetContributions = jest.fn().mockReturnValue([]);

jest.mock(
  'components/Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      extensionRegistry: { getContributions: mockGetContributions },
      getContributions: mockGetContributions,
    }),
  })
);

jest.mock('./TaskAssetCard', () => ({
  __esModule: true,
  default: ({ StatTiles }: { StatTiles?: ComponentType }) => (
    <div data-testid="task-asset-card">{StatTiles && <StatTiles />}</div>
  ),
}));

jest.mock('./TaskDetailSummary', () => ({
  __esModule: true,
  default: ({
    rows,
    callout,
  }: {
    rows: { key: string }[];
    callout?: { label: string };
  }) => (
    <div
      data-callout={callout?.label}
      data-rows={rows.map((row) => row.key).join(',')}
      data-testid="task-detail-summary"
    />
  ),
}));

jest.mock('./TaskActionCommentModal', () => ({
  __esModule: true,
  default: ({
    open,
    onConfirm,
    onCancel,
  }: {
    open?: boolean;
    onConfirm: (...args: unknown[]) => void;
    onCancel?: () => void;
  }) =>
    open ? (
      <div data-testid="comment-modal">
        <button
          aria-label="modal-confirm"
          data-testid="modal-confirm"
          onClick={() => onConfirm({ comment: 'a comment' })}
        />
        <button
          aria-label="modal-cancel"
          data-testid="modal-cancel"
          onClick={onCancel}
        />
      </div>
    ) : null,
}));

jest.mock(
  'components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew',
  () => {
    const { forwardRef, useImperativeHandle } = jest.requireActual('react');

    return {
      __esModule: true,
      default: forwardRef(
        (
          { onSave }: { onSave?: (m: string) => void },
          ref: React.Ref<unknown>
        ) => {
          useImperativeHandle(ref, () => ({
            getEditorContent: () => '',
            clearEditorContent: jest.fn(),
          }));

          return (
            <button
              data-testid="comment-editor"
              onClick={() => onSave?.('edited')}>
              editor
            </button>
          );
        }
      ),
    };
  }
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
  Alert: jest.requireActual('@openmetadata/ui-core-components').Alert,
  Dot: () => <span />,
  BadgeWithDot: ({
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
  Dropdown: {
    Root: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Popover: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Menu: ({
      children,
      onAction,
    }: {
      children?: ReactNode;
      onAction?: (key: string) => void;
    }) => (
      <div data-onaction={Boolean(onAction)} role="menu">
        {children}
      </div>
    ),
    Item: ({
      children,
      'data-testid': testId,
    }: {
      children?: ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={testId}>{children}</div>,
  },
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
  ButtonUtility: ({
    children,
    onClick,
    isDisabled,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    onClick?: (...args: unknown[]) => void;
    isDisabled?: boolean;
    'data-testid'?: string;
  }) => (
    <button data-testid={testId} disabled={isDisabled} onClick={onClick}>
      {children}
    </button>
  ),
  Typography: ({
    children,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <span data-testid={testId}>{children}</span>,
  EmptyPlaceholder: ({
    title,
    description,
    actions,
    'data-testid': testId,
  }: {
    title?: ReactNode;
    description?: ReactNode;
    actions?: { key: string; label: ReactNode; onPress?: () => void }[];
    'data-testid'?: string;
  }) => (
    <div data-testid={testId}>
      <span>{title}</span>
      <span>{description}</span>
      {actions?.map(({ key, label, onPress }) => (
        <button key={key} onClick={onPress}>
          {label}
        </button>
      ))}
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

jest.mock(
  '@openmetadata/ui-core-components/icons',
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

const mockT = jest.fn((key: string) => key);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

jest.mock('react-router-dom', () => ({
  Link: ({
    children,
    className,
    to,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    className?: string;
    to?: string;
    'data-testid'?: string;
  }) => (
    <a className={className} data-testid={testId} href={to}>
      {children}
    </a>
  ),
}));

jest.mock('utils/TaskNavigationUtils', () => ({
  ...jest.requireActual('utils/TaskNavigationUtils'),
  getTaskAboutPath: () => '',
}));

jest.mock('enums/entity.enum', () => ({
  ...jest.requireActual('enums/entity.enum'),
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

const NEW_STATUS = {
  id: 'st-1',
  testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
  timestamp: 1000,
  severity: 'Severity1',
} as TestCaseResolutionStatus;

const ACK_STATUS = {
  id: 'st-2',
  testCaseResolutionStatusType: TestCaseResolutionStatusTypes.ACK,
  timestamp: 2000,
  severity: 'Severity1',
} as TestCaseResolutionStatus;

const INCIDENT_TASK = {
  id: 'task-1',
  taskId: '42',
  name: 'Incident-001',
  displayName: 'Incident on orders.row_count',
  status: 'Open',
  createdAt: 1000,
  createdBy: { id: 'u1', name: 'alice', type: 'user' },
  type: 'TestCaseResolution',
  category: 'Incident',
  about: {
    id: 'tc1',
    type: 'testCase',
    name: 'row_count',
    fullyQualifiedName: 'svc.db.sch.orders.row_count',
  },
  availableTransitions: [{ id: 'ack', label: 'Ack', resolutionType: 'ACK' }],
  comments: [],
} as unknown as Task;

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

const renderPanel = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <TaskDetailPanel taskId="task-1" />
    </QueryClientProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = { name: 'bob' };
  mockGetContributions.mockReturnValue([]);
  mockGetTaskById.mockResolvedValue({ data: INCIDENT_TASK });
  mockGetEntityPermission.mockResolvedValue({ ResolveTask: true });
  mockGetResolvedTaskFormSchema.mockResolvedValue(undefined);
  mockGetTestCaseByFqn.mockResolvedValue({
    id: 'tc1',
    name: 'row_count',
    entityLink: '<#E::table::svc.db.sch.orders>',
    testDefinition: { id: 'd1', name: 'tableRowCountToEqual' },
  });
  mockGetTable.mockResolvedValue({ tags: [] });
  mockGetIncidents.mockResolvedValue({ data: [NEW_STATUS] });
  mockResolveTask.mockResolvedValue({
    ...INCIDENT_TASK,
    status: 'InProgress',
  });
});

describe('TaskDetailPanel about-entity cache invalidation', () => {
  it('refetches the incident status history after an ack transition', async () => {
    const queryClient = makeQueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => renderPanel(queryClient));

    await waitFor(() => expect(mockGetIncidents).toHaveBeenCalledTimes(1));

    expect(mockGetIncidents).toHaveBeenCalledWith('task-1');

    // The panel's only the opening record so far, so the timeline it renders
    // through the real TaskActivityTimeline shows no acknowledgment yet.
    expect(
      screen.queryByText('message.task-event-incident-acknowledged')
    ).not.toBeInTheDocument();

    mockGetIncidents.mockResolvedValue({ data: [NEW_STATUS, ACK_STATUS] });

    await act(async () => {
      fireEvent.click(screen.getByTestId('task-transition-ack'));
    });

    expect(mockResolveTask).toHaveBeenCalledWith('task-1', {
      transitionId: 'ack',
      resolutionType: 'ACK',
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['inbox-task-about-entity'],
    });

    await waitFor(() => expect(mockGetIncidents).toHaveBeenCalledTimes(2));

    expect(mockGetIncidents).toHaveBeenLastCalledWith('task-1');

    // The invalidated about-entity query refetched the appended ACK record,
    // and the real timeline now renders the acknowledgment event — proving the
    // refreshed history reaches the timeline, not just the cache wiring.
    await waitFor(() => {
      expect(
        screen.getByText('message.task-event-incident-acknowledged')
      ).toBeInTheDocument();
    });

    queryClient.clear();
  });

  it('does not refetch the incident status history when the transition fails', async () => {
    const queryClient = makeQueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    mockResolveTask.mockRejectedValueOnce(new Error('denied'));

    await act(async () => renderPanel(queryClient));
    await waitFor(() => expect(mockGetIncidents).toHaveBeenCalledTimes(1));

    await act(async () => {
      fireEvent.click(screen.getByTestId('task-transition-ack'));
    });

    expect(mockResolveTask).toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: ['inbox-task-about-entity'],
    });

    await waitFor(() => expect(mockGetIncidents).toHaveBeenCalledTimes(1));

    queryClient.clear();
  });
});
