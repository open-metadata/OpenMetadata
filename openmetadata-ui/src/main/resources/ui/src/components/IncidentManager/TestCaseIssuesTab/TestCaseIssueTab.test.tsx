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
import React from 'react';
import { useActivityFeedProvider } from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import TestCaseIssueTab from './TestCaseIssueTab.component';
const mockThread = [
  {
    id: '33873393-bd68-46e9-bccc-7701c1c41ad6',
    type: 'Task',
    threadTs: 1703570590556,
    about:
      '<#E::testCase::sample_data.ecommerce_db.shopify.dim_address.table_column_count_between>',
    entityId: '6206a003-281c-4984-9728-4e949a4e4023',
    createdBy: 'admin',
    updatedAt: 1703570590652,
    updatedBy: 'admin',
    resolved: false,
    message: 'Test Case Failure Resolution requested for ',
    postsCount: 1,
    posts: [
      {
        id: 'a3e5f8cc-f852-47a4-b2a3-3dd4f5e52f89',
        message: 'Resolved the Task.',
        postTs: 1703570590652,
        from: 'admin',
        reactions: [],
      },
    ],
    task: {
      id: 6,
      type: 'RequestTestCaseFailureResolution',
      assignees: [
        {
          id: 'd75b492b-3b73-449d-922c-14b61bc44b3d',
          type: 'user',
          name: 'aaron_johnson0',
          fullyQualifiedName: 'aaron_johnson0',
          displayName: 'Aaron Johnson',
          deleted: false,
        },
      ],
      status: 'Closed',
      closedBy: 'admin',
      closedAt: 1703570590648,
      newValue: 'Resolution comment',
      testCaseResolutionStatusId: 'f93d08e9-2d38-4d01-a294-f8b44fbb0f4a',
    },
  },
  {
    id: '9950d7a0-01a4-4e02-bd7f-c431d9cd77f1',
    type: 'Task',
    threadTs: 1703570590829,
    about:
      '<#E::testCase::sample_data.ecommerce_db.shopify.dim_address.table_column_count_between>',
    entityId: '6206a003-281c-4984-9728-4e949a4e4023',
    createdBy: 'admin',
    updatedAt: 1703570590829,
    updatedBy: 'admin',
    resolved: false,
    message: 'Test Case Failure Resolution requested for ',
    postsCount: 0,
    posts: [],
    task: {
      id: 9,
      type: 'RequestTestCaseFailureResolution',
      assignees: [
        {
          id: 'd75b492b-3b73-449d-922c-14b61bc44b3d',
          type: 'user',
          name: 'aaron_johnson0',
          fullyQualifiedName: 'aaron_johnson0',
          displayName: 'Aaron Johnson',
          deleted: false,
        },
      ],
      status: 'Open',
      testCaseResolutionStatusId: 'c0bd7ad8-ada8-48b0-82dd-799df5f5a737',
    },
  },
];

const mockUseActivityFeedProviderValue = {
  entityPaging: { total: 4 },
  entityThread: mockThread,
  getFeedData: jest.fn().mockImplementation(() => Promise.resolve()),
  loading: false,
  selectedThread: mockThread[0],
  setActiveThread: jest.fn(),
};

jest.mock('../../Task/TaskTab/TaskTab.component', () => {
  return {
    TaskTab: jest.fn().mockImplementation(({ onAfterClose }) => (
      <div>
        TaskTab
        <button data-testid="close-btn" onClick={onAfterClose}>
          Close
        </button>
      </div>
    )),
  };
});
jest.mock('../../Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});
jest.mock(
  '../../ActivityFeed/ActivityFeedList/ActivityFeedListV1.component',
  () => {
    return jest.fn().mockImplementation(({ onFeedClick }) => (
      <div>
        ActivityFeedListV1
        <button data-testid="feed" onClick={() => onFeedClick(mockThread[1])}>
          Task1
        </button>
      </div>
    ));
  }
);
jest.mock(
  '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
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
    render(<TestCaseIssueTab />);

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
    render(<TestCaseIssueTab />);

    expect(await screen.findAllByText('Loader')).toHaveLength(2);
  });

  it('Should call getFeedData after closing the task', async () => {
    render(<TestCaseIssueTab />);

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
    render(<TestCaseIssueTab />);

    const feed = await screen.findByTestId('feed');
    await act(async () => {
      fireEvent.click(feed);
    });

    expect(
      mockUseActivityFeedProviderValue.setActiveThread
    ).toHaveBeenCalledWith(mockThread[1]);
  });

  it('Should call setActiveThread, on click of open and close task btn', async () => {
    render(<TestCaseIssueTab />);

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
