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
import { MOCK_THREAD_DATA } from '../../../../mocks/TestCase.mock';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import TestCaseIncidentTab from './TestCaseIncidentTab.component';

const mockUseActivityFeedProviderValue = {
  entityPaging: { total: 4 },
  entityThread: MOCK_THREAD_DATA,
  getFeedData: jest.fn().mockImplementation(() => Promise.resolve()),
  loading: false,
  selectedThread: MOCK_THREAD_DATA[0],
  setActiveThread: jest.fn(),
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
jest.mock(
  '../../../ActivityFeed/ActivityFeedList/ActivityFeedListV1New.component',
  () => {
    return jest.fn().mockImplementation(({ onFeedClick }) => (
      <div>
        ActivityFeedListV1
        <button
          data-testid="feed"
          onClick={() => onFeedClick(MOCK_THREAD_DATA[1])}>
          Task1
        </button>
      </div>
    ));
  }
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
    expect(await screen.findByText('ActivityFeedListV1')).toBeInTheDocument();
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

  it('Should call setActiveThread, on click of task', async () => {
    render(<TestCaseIncidentTab />);

    const feed = await screen.findByTestId('feed');
    await act(async () => {
      fireEvent.click(feed);
    });

    expect(
      mockUseActivityFeedProviderValue.setActiveThread
    ).toHaveBeenCalledWith(MOCK_THREAD_DATA[1]);
  });

  it('Should call setActiveThread, on click of open and close task btn', async () => {
    render(<TestCaseIncidentTab />);

    const closeTaskBtn = await screen.findByTestId('closed-task');
    await act(async () => {
      fireEvent.click(closeTaskBtn);
    });

    expect(mockUseActivityFeedProviderValue.setActiveThread).toHaveBeenCalled();

    const openTaskBtn = await screen.findByTestId('open-task');
    await act(async () => {
      fireEvent.click(openTaskBtn);
    });

    expect(mockUseActivityFeedProviderValue.setActiveThread).toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(openTaskBtn);
    });

    expect(
      mockUseActivityFeedProviderValue.setActiveThread
    ).toHaveBeenCalledTimes(2);
  });
});
