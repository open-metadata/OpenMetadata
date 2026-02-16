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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MOCK_TASK_DATA } from '../../../../mocks/TestCase.mock';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import TestCaseIncidentTab from './TestCaseIncidentTab.component';

const mockUseActivityFeedProviderValue = {
  entityPaging: { total: 4 },
  tasks: MOCK_TASK_DATA,
  getFeedData: jest.fn().mockImplementation(() => Promise.resolve()),
  loading: false,
  selectedTask: MOCK_TASK_DATA[0],
  setActiveTask: jest.fn(),
};

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
    TaskTabNew: jest.fn().mockImplementation(({ onAfterClose }) => (
      <div>
        TaskTab
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
  return jest.fn().mockImplementation(({ onTaskClick }) => (
    <div>
      TaskListV1
      <button data-testid="task" onClick={() => onTaskClick(MOCK_TASK_DATA[1])}>
        Task1
      </button>
    </div>
  ));
});
jest.mock(
  '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest
      .fn()
      .mockImplementation(() => mockUseActivityFeedProviderValue),
  })
);
jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    fqn: 'sample_data.ecommerce_db.shopify.dim_address.table_column_count_between',
  }),
}));

describe('TestCaseIssueTab', () => {
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
  });

  it('Should render loader', async () => {
    (useActivityFeedProvider as jest.Mock).mockImplementationOnce(() => ({
      ...mockUseActivityFeedProviderValue,
      loading: true,
    }));
    render(<TestCaseIncidentTab />);

    expect(await screen.findAllByText('Loader')).toHaveLength(2);
  });

  it('Should call getFeedData after closing the task', async () => {
    render(<TestCaseIncidentTab />);

    const closeBtn = await screen.findByTestId('close-btn');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(mockUseActivityFeedProviderValue.getFeedData).toHaveBeenCalledWith(
      undefined,
      undefined,
      'Task',
      'testCase',
      'sample_data.ecommerce_db.shopify.dim_address.table_column_count_between'
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
