/*
 *  Copyright 2023 Collate.
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
import { useState } from 'react';
import { MOCK_TASK_DATA } from '../../../../mocks/TestCase.mock';
import {
  Task,
  TaskEntityStatus,
  TaskEntityType,
} from '../../../../rest/tasksAPI';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import TestCaseIncidentTab from './TestCaseIncidentTab.component';

const mockUseActivityFeedProviderValue = {
  entityPaging: { total: 4 },
  tasks: MOCK_TASK_DATA,
  getTaskData: jest.fn().mockImplementation(() => Promise.resolve()),
  loading: false,
  selectedTask: MOCK_TASK_DATA[0],
  setActiveTask: jest.fn(),
};
const mockTestCaseFqn =
  'sample_data.ecommerce_db.shopify.dim_address.table_column_count_between';
const mockGetTaskById = jest.fn();
const mockSearchParams = new URLSearchParams();
let mockUseRealTaskList = false;

jest.mock('../../../../rest/tasksAPI', () => ({
  ...jest.requireActual('../../../../rest/tasksAPI'),
  getTaskById: (...args: unknown[]) => mockGetTaskById(...args),
  getTaskCounts: jest.fn().mockResolvedValue({}),
}));

jest.mock(
  '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store',
  () => ({
    useTestCaseStore: jest.fn().mockImplementation(() => ({
      testCase: {
        owner: {
          name: 'arron_johnson',
          displayName: 'Arron Johnson',
          id: '1',
          type: 'user',
        },
      },
    })),
  })
);

jest.mock('../../../Entity/Task/TaskTab/TaskTabNew.component', () => {
  return {
    TaskTabNew: jest.fn().mockImplementation(({ onAfterClose, task }) => (
      <div>
        TaskTab
        <span data-testid="incident-detail-id">{task.id}</span>
        <button data-testid="close-btn" onClick={onAfterClose}>
          Close
        </button>
      </div>
    )),
  };
});
jest.mock('../../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});
jest.mock('../../../ActivityFeed/ActivityFeedList/TaskListV1.component', () => {
  const ActualTaskList = jest.requireActual(
    '../../../ActivityFeed/ActivityFeedList/TaskListV1.component'
  ).default;

  return jest.fn().mockImplementation((props) =>
    mockUseRealTaskList ? (
      <ActualTaskList {...props} />
    ) : (
      <div>
        TaskListV1
        <button
          data-testid="task"
          onClick={() => props.onTaskClick(MOCK_TASK_DATA[1])}>
          Task1
        </button>
      </div>
    )
  );
});
jest.mock(
  '../../../ActivityFeed/TaskFeedCard/TaskFeedCardFromTask.component',
  () =>
    ({ task }: { task: Task }) =>
      <span>{task.id}</span>
);
jest.mock(
  '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest
      .fn()
      .mockImplementation(() => mockUseActivityFeedProviderValue),
  })
);
jest.mock('react-router-dom', () => ({
  useParams: () => ({
    fqn: mockTestCaseFqn,
  }),
  useSearchParams: () => [mockSearchParams],
}));

describe('TestCaseIssueTab', () => {
  beforeEach(() => {
    mockSearchParams.delete('taskId');
    mockUseRealTaskList = false;
  });

  it('opens the linked resolved incident in the closed view', async () => {
    const task = {
      ...MOCK_TASK_DATA[0],
      id: 'resolved-incident',
      type: TaskEntityType.TestCaseResolution,
      status: TaskEntityStatus.Completed,
      about: {
        id: 'test-case',
        type: 'testCase',
        fullyQualifiedName: mockTestCaseFqn,
      },
    };
    mockSearchParams.set('taskId', task.id);
    mockGetTaskById.mockResolvedValue({ data: task });

    render(<TestCaseIncidentTab />);

    await waitFor(() => {
      expect(
        mockUseActivityFeedProviderValue.setActiveTask
      ).toHaveBeenCalledWith(task);
      expect(
        mockUseActivityFeedProviderValue.getTaskData
      ).toHaveBeenLastCalledWith(
        undefined,
        undefined,
        'testCase',
        mockTestCaseFqn,
        'closed'
      );
    });
  });

  it('keeps a linked closed incident selected outside the loaded page', async () => {
    const incident = {
      ...MOCK_TASK_DATA[0],
      id: 'older-closed-incident',
      type: TaskEntityType.TestCaseResolution,
      status: TaskEntityStatus.Completed,
      about: {
        id: 'test-case',
        type: 'testCase',
        fullyQualifiedName: mockTestCaseFqn,
      },
    };
    mockUseRealTaskList = true;
    mockSearchParams.set('taskId', incident.id);
    let finishLookup!: () => void;
    mockGetTaskById.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLookup = () => resolve({ data: incident });
        })
    );

    const list = [{ ...incident, id: 'first-closed-incident' }];
    const mockProvider = useActivityFeedProvider as jest.Mock;
    const previousProvider = mockProvider.getMockImplementation();
    mockProvider.mockImplementation(function useTestProvider() {
      const [selectedTask, setActiveTask] = useState<Task>();

      return {
        ...mockUseActivityFeedProviderValue,
        tasks: list,
        selectedTask,
        setActiveTask,
      };
    });

    try {
      render(<TestCaseIncidentTab />);

      expect(
        screen.queryByTestId('incident-detail-id')
      ).not.toBeInTheDocument();

      await act(async () => finishLookup());
      await waitFor(() =>
        expect(screen.getByTestId('incident-detail-id')).toHaveTextContent(
          incident.id
        )
      );

      expect(
        screen.getByText(incident.id, { selector: '#taskData span' })
      ).toBeInTheDocument();
    } finally {
      if (previousProvider) {
        mockProvider.mockImplementation(previousProvider);
      }
    }
  });

  it('Should render component', async () => {
    render(<TestCaseIncidentTab />);

    expect(
      await screen.findByTestId('issue-tab-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('left-container')).toBeInTheDocument();
    expect(await screen.findByTestId('right-container')).toBeInTheDocument();
    expect(await screen.findByTestId('open-task')).toBeInTheDocument();
    expect(await screen.findByTestId('closed-task')).toBeInTheDocument();
    expect(await screen.findByText('TaskListV1')).toBeInTheDocument();
    expect(await screen.findByText('TaskTab')).toBeInTheDocument();
    expect(mockUseActivityFeedProviderValue.getTaskData).toHaveBeenCalledWith(
      undefined,
      undefined,
      'testCase',
      'sample_data.ecommerce_db.shopify.dim_address.table_column_count_between',
      'open'
    );
  });

  it('Should render loader', async () => {
    (useActivityFeedProvider as jest.Mock).mockImplementationOnce(() => ({
      ...mockUseActivityFeedProviderValue,
      loading: true,
    }));
    render(<TestCaseIncidentTab />);

    expect(await screen.findAllByText('Loader')).toHaveLength(2);
  });

  it('Should call getTaskData after closing the task', async () => {
    render(<TestCaseIncidentTab />);

    const closeBtn = await screen.findByTestId('close-btn');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(mockUseActivityFeedProviderValue.getTaskData).toHaveBeenCalledWith(
      undefined,
      undefined,
      'testCase',
      'sample_data.ecommerce_db.shopify.dim_address.table_column_count_between',
      'closed'
    );
  });

  it('Should call setActiveTask, on click of task', async () => {
    render(<TestCaseIncidentTab />);

    const task = await screen.findByTestId('task');
    await act(async () => {
      fireEvent.click(task);
    });

    expect(mockUseActivityFeedProviderValue.setActiveTask).toHaveBeenCalledWith(
      MOCK_TASK_DATA[1]
    );
  });

  it('Should call setActiveTask, on click of open and close task btn', async () => {
    render(<TestCaseIncidentTab />);

    const closeTaskBtn = await screen.findByTestId('closed-task');
    await act(async () => {
      fireEvent.click(closeTaskBtn);
    });

    expect(mockUseActivityFeedProviderValue.setActiveTask).toHaveBeenCalled();

    const openTaskBtn = await screen.findByTestId('open-task');
    await act(async () => {
      fireEvent.click(openTaskBtn);
    });

    expect(mockUseActivityFeedProviderValue.setActiveTask).toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(openTaskBtn);
    });

    expect(
      mockUseActivityFeedProviderValue.setActiveTask
    ).toHaveBeenCalledTimes(2);
  });
});
