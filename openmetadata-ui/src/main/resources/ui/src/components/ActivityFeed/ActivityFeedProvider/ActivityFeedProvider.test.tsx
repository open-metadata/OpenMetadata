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
import { mockUserData } from '../../../mocks/MyDataPage.mock';
import {
  deletePostById,
  deleteThread,
  getAllFeeds,
  postFeedById,
} from '../../../rest/feedsAPI';
import ActivityFeedProvider from './ActivityFeedProvider';
import {
  DummyChildrenComponent,
  DummyChildrenDeletePostComponent,
  DummyChildrenEntityComponent,
  DummyChildrenTaskCloseComponent,
} from './DummyTestComponent';

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock('../ActivityFeedDrawer/ActivityFeedDrawer', () =>
  jest.fn().mockImplementation(() => <p>Entity ActivityFeedDrawer</p>)
);

jest.mock('../../../rest/feedsAPI', () => ({
  deletePostById: jest.fn(),
  deleteThread: jest.fn(),
  getAllFeeds: jest.fn(),
  getFeedById: jest.fn(),
  postFeedById: jest.fn(),
  updatePost: jest.fn(),
  updateThread: jest.fn(),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getListTestCaseIncidentByStateId: jest.fn(),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityFeedLink: jest.fn(),
  getEntityReferenceListFromEntities: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/FeedUtils', () => ({
  getUpdatedThread: jest.fn(),
}));

describe('ActivityFeedProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading indicator in initial fetch', async () => {
    render(
      <ActivityFeedProvider>
        <DummyChildrenComponent />
      </ActivityFeedProvider>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should call getFeedData with open task for user', async () => {
    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenComponent />
        </ActivityFeedProvider>
      );
    });

    expect(getAllFeeds).toHaveBeenCalledWith(
      undefined,
      undefined,
      'Task',
      'OWNER_OR_FOLLOWS',
      'Open',
      undefined,
      undefined
    );
  });

  it('should call getFeedData with closed task and afterThread for user', async () => {
    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenTaskCloseComponent />
        </ActivityFeedProvider>
      );
    });

    expect(getAllFeeds).toHaveBeenCalledWith(
      undefined,
      'after-234',
      'Task',
      'OWNER_OR_FOLLOWS',
      'Closed',
      undefined,
      undefined
    );
  });

  it('should call getFeedData for table entity', async () => {
    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenEntityComponent />
        </ActivityFeedProvider>
      );
    });

    expect(getAllFeeds).toHaveBeenCalledWith(
      undefined,
      undefined,
      'Conversation',
      'ALL',
      undefined,
      undefined,
      undefined
    );
  });

  it('should call postFeed with button click', async () => {
    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenComponent />
        </ActivityFeedProvider>
      );
    });

    fireEvent.click(screen.getByTestId('post-feed'));

    expect(postFeedById).toHaveBeenCalledWith('123', {
      from: 'Test User',
      message: 'New Post Feed added',
    });
  });

  it('should call deleteThread with button click when isThread is true', async () => {
    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenComponent />
        </ActivityFeedProvider>
      );
    });

    fireEvent.click(screen.getByTestId('delete-feed'));

    expect(deleteThread).toHaveBeenCalledWith('123');
    expect(deletePostById).not.toHaveBeenCalled();
  });

  it('should call deletePostId with button click when isThread is false', async () => {
    await act(async () => {
      render(
        <ActivityFeedProvider>
          <DummyChildrenDeletePostComponent />
        </ActivityFeedProvider>
      );
    });

    fireEvent.click(screen.getByTestId('delete-feed'));

    expect(deleteThread).not.toHaveBeenCalled();
    expect(deletePostById).toHaveBeenCalledWith('123', '456');
  });
});
