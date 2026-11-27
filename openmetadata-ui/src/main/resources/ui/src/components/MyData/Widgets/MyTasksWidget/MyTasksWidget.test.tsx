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
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import { Task, TaskCategory } from '../../../../generated/entity/tasks/task';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { useMyTasks } from '../../../../hooks/useMyTasks';
import { MyTaskBucket } from '../../../../utils/myTaskBuckets';
import { getEntityTasksPath } from '../../../../utils/TaskNavigationUtils';
import MyTasksWidget from './MyTasksWidget';
import { useBulkResolveTasks } from './useBulkResolveTasks';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: 'en' },
  }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children?: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../../../hooks/useAppMode', () => ({
  useIsAiMode: jest.fn(),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: (
    selector: (state: { currentUser: { name: string } }) => unknown
  ) => selector({ currentUser: { name: 'dale' } }),
}));

jest.mock('../../../../hooks/useMyTasks', () => ({
  useMyTasks: jest.fn(),
}));

jest.mock('./useBulkResolveTasks', () => ({
  useBulkResolveTasks: jest.fn(),
}));

// The real title is composed from the task type and its entity; the card only
// needs a distinct one per task.
jest.mock(
  '../../../discovery/personal-space/InboxPage/taskTitle.utils',
  () => ({
    getTaskTitle: (task: Task) => `title-${task.id}`,
  })
);

const task = (id: string, category: TaskCategory, commentCount = 0) =>
  ({
    about: {
      fullyQualifiedName: `svc.db.schema.asset_${id}`,
      id: `about-${id}`,
      name: `asset_${id}`,
      type: 'table',
    },
    category,
    commentCount,
    createdAt: 1_700_000_000_000,
    createdBy: { id: 'u', name: 'testsuite-bot', type: 'user' },
    id,
    taskId: `TASK-00${id}`,
  } as unknown as Task);

const INCIDENT = task('1', TaskCategory.Incident, 2);
const ACCESS = task('2', TaskCategory.DataAccess);
const APPROVAL = task('3', TaskCategory.Approval);

const MY_TASKS = {
  counts: {
    [MyTaskBucket.ALL]: 25,
    [MyTaskBucket.INCIDENTS]: 1,
    [MyTaskBucket.ACCESS]: 1,
    [MyTaskBucket.APPROVALS]: 1,
  },
  dataUpdatedAt: 0,
  isError: false,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
  tasks: [INCIDENT, ACCESS, APPROVAL],
  total: 25,
};

const mockResolveTasks = jest.fn().mockResolvedValue({ unresolvedIds: [] });

const renderWidget = (
  myTasks: Partial<typeof MY_TASKS> = {},
  isAiMode = false
) => {
  (useIsAiMode as jest.Mock).mockReturnValue(isAiMode);
  (useMyTasks as jest.Mock).mockReturnValue({ ...MY_TASKS, ...myTasks });
  (useBulkResolveTasks as jest.Mock).mockReturnValue({
    isResolving: false,
    resolveTasks: mockResolveTasks,
  });

  return render(<MyTasksWidget widgetKey="KnowledgePanel.MyTask-1" />);
};

const rowIds = () =>
  within(screen.getByTestId('my-task-rows'))
    .getAllByRole('listitem')
    .map((row) => row.getAttribute('data-testid'));

const select = (id: string) =>
  fireEvent.click(
    within(screen.getByTestId(`my-task-select-${id}`)).getByRole('checkbox')
  );

describe('MyTasksWidget', () => {
  beforeEach(() => jest.clearAllMocks());

  it('leads the summary with the open total and flags incidents', () => {
    renderWidget();

    expect(
      screen.getByText(
        /message\.count-open-tasks-assigned-to-you {"count":25} message\.count-incidents-need-resolution {"count":1}/
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('topic-status-myTasks')).toHaveTextContent(
      'message.count-incident {"count":1}'
    );
  });

  it('carries no status chip when nothing is an incident', () => {
    renderWidget({
      counts: { ...MY_TASKS.counts, [MyTaskBucket.INCIDENTS]: 0 },
      tasks: [ACCESS, APPROVAL],
    });

    expect(screen.queryByTestId('topic-status-myTasks')).toBeNull();
  });

  it('lists every loaded task, then narrows to a bucket from its chip', () => {
    renderWidget();

    expect(rowIds()).toEqual([
      'my-task-row-1',
      'my-task-row-2',
      'my-task-row-3',
    ]);

    fireEvent.click(screen.getByTestId('my-tasks-filter-access'));

    expect(rowIds()).toEqual(['my-task-row-2']);
  });

  it('opens the rows straight under the chips, with no select-all strip', () => {
    renderWidget();

    expect(screen.queryByTestId('my-tasks-select-all')).not.toBeInTheDocument();
    expect(screen.queryByTestId('my-tasks-showing')).not.toBeInTheDocument();
    expect(screen.getByTestId('my-tasks-filter-chips').nextElementSibling).toBe(
      screen.getByTestId('my-task-rows')
    );
    expect(rowIds()).toHaveLength(3);
  });

  // The chips are counted over the loaded page: "Incidents 1" alone would read
  // as every incident when 22 more tasks were never loaded.
  it('says how much of the total the page holds, under every chip', () => {
    renderWidget();

    const pageLimit =
      'label.loaded-x-of-y-entity {"entity":"label.task-plural","loaded":3,"total":25}';

    expect(screen.getByTestId('my-tasks-page-limit')).toHaveTextContent(
      pageLimit
    );

    fireEvent.click(screen.getByTestId('my-tasks-filter-access'));

    expect(screen.getByTestId('my-tasks-page-limit')).toHaveTextContent(
      pageLimit
    );
  });

  it('drops the page limit once every task is loaded', () => {
    renderWidget({ total: 3 });

    fireEvent.click(screen.getByTestId('my-tasks-filter-access'));

    expect(screen.queryByTestId('my-tasks-page-limit')).not.toBeInTheDocument();
  });

  // The entity pages have no per-task route; a link there renders nothing.
  it('opens a task in the inbox in AI mode', () => {
    renderWidget({}, true);

    expect(
      within(screen.getByTestId('my-task-row-1')).getByRole('link')
    ).toHaveAttribute('href', '/inbox/tasks?taskId=1');
  });

  it("links each row to its asset's tasks and shows who raised it", () => {
    renderWidget();

    const row = screen.getByTestId('my-task-row-1');

    expect(within(row).getByRole('link')).toHaveAttribute(
      'href',
      getEntityTasksPath(EntityType.TABLE, 'svc.db.schema.asset_1')
    );
    expect(row).toHaveTextContent('#001');
    expect(row).toHaveTextContent('testsuite-bot');
    expect(within(row).getByTestId('my-task-entity')).toHaveTextContent(
      'asset_1'
    );
  });

  it('offers Grant and Deny for selected access requests and resolves them', async () => {
    renderWidget();

    select('2');

    expect(screen.getByTestId('my-tasks-selected-count')).toHaveTextContent(
      'label.n-selected {"count":1}'
    );
    expect(screen.getByTestId('my-tasks-bulk-approve')).toHaveTextContent(
      'label.grant'
    );
    expect(screen.getByTestId('my-tasks-bulk-reject')).toHaveTextContent(
      'label.deny'
    );

    fireEvent.click(screen.getByTestId('my-tasks-bulk-approve'));

    expect(mockResolveTasks).toHaveBeenCalledWith({
      decision: 'approve',
      tasks: [ACCESS],
    });

    // A resolved selection is cleared, so the bar goes with it.
    await waitFor(() =>
      expect(screen.queryByTestId('my-tasks-selection-bar')).toBeNull()
    );
  });

  it('rejects the selection with the secondary action', async () => {
    renderWidget();

    select('2');
    select('3');

    expect(screen.getByTestId('my-tasks-bulk-reject')).toHaveTextContent(
      'label.reject'
    );

    fireEvent.click(screen.getByTestId('my-tasks-bulk-reject'));

    expect(mockResolveTasks).toHaveBeenCalledWith({
      decision: 'reject',
      tasks: [ACCESS, APPROVAL],
    });

    await waitFor(() =>
      expect(screen.queryByTestId('my-tasks-selection-bar')).toBeNull()
    );
  });

  it('keeps the tasks that failed to resolve selected for a retry', async () => {
    mockResolveTasks.mockResolvedValueOnce({ unresolvedIds: ['3'] });
    renderWidget();

    select('2');
    select('3');
    fireEvent.click(screen.getByTestId('my-tasks-bulk-approve'));

    await waitFor(() =>
      expect(screen.getByTestId('my-tasks-selected-count')).toHaveTextContent(
        'label.n-selected {"count":1}'
      )
    );
  });

  // An incident needs a root cause, so the card hands it to the tasks page
  // rather than resolving it blind.
  it('sends an incident selection to the tasks page instead of resolving it', () => {
    renderWidget();

    select('1');

    expect(screen.queryByTestId('my-tasks-bulk-approve')).toBeNull();

    fireEvent.click(screen.getByTestId('my-tasks-open-tasks'));

    expect(mockNavigate).toHaveBeenCalledWith('/users/dale/task');
    expect(mockResolveTasks).not.toHaveBeenCalled();
  });

  it('clears the selection when the bucket changes', () => {
    renderWidget();

    select('2');
    fireEvent.click(screen.getByTestId('my-tasks-filter-approvals'));

    expect(screen.queryByTestId('my-tasks-selection-bar')).toBeNull();
  });

  it('opens the inbox in AI mode and the profile tab in Classic', () => {
    const { unmount } = renderWidget({}, true);

    fireEvent.click(screen.getByTestId('topic-action-myTasks'));

    expect(mockNavigate).toHaveBeenLastCalledWith('/inbox/tasks');

    unmount();
    renderWidget({}, false);
    fireEvent.click(screen.getByTestId('topic-action-myTasks'));

    expect(mockNavigate).toHaveBeenLastCalledWith('/users/dale/task');
  });

  it('shows the all-clear empty state when nothing is open', () => {
    renderWidget({
      counts: {
        [MyTaskBucket.ALL]: 0,
        [MyTaskBucket.INCIDENTS]: 0,
        [MyTaskBucket.ACCESS]: 0,
        [MyTaskBucket.APPROVALS]: 0,
      },
      tasks: [],
      total: 0,
    });

    expect(screen.getByTestId('topic-empty-myTasks')).toHaveTextContent(
      'message.you-are-all-caught-up'
    );
    expect(
      screen.getByText('message.no-open-tasks-assigned-to-you')
    ).toBeVisible();
    expect(
      screen.getByText('label.count-open {"count":0}')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('my-task-rows')).toBeNull();

    // Even with nothing open, the footer still leads to the full task list.
    fireEvent.click(screen.getByTestId('topic-action-myTasks'));

    expect(mockNavigate).toHaveBeenCalledWith('/users/dale/task');
  });

  it('shows an error body when the fetch fails', () => {
    renderWidget({ isError: true, tasks: [], total: 0 });

    expect(screen.getByTestId('topic-error-myTasks')).toBeInTheDocument();
  });
});
