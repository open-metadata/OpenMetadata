/*
 *  Copyright 2021 Collate
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

import { findByTestId, queryByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { mockThreadData } from './ActivityThread.mock';
import ActivityThreadList from './ActivityThreadList';

jest.mock('../../../utils/FeedUtils', () => ({
  getFeedListWithRelativeDays: jest.fn().mockReturnValue({
    updatedFeedList: mockThreadData,
    relativeDays: ['Today', 'Yesterday'],
  }),
}));

const mockActivityThreadListProp = {
  threads: mockThreadData,
  selectedThreadId: '',
  postFeed: jest.fn(),
  onThreadIdSelect: jest.fn(),
  onThreadSelect: jest.fn(),
  onConfirmation: jest.fn(),
};

jest.mock('../ActivityFeedCard/ActivityFeedCard', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedCard</p>);
});

jest.mock('../ActivityFeedEditor/ActivityFeedEditor', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedEditor</p>);
});

jest.mock('../ActivityFeedList/FeedListSeparator', () => {
  return jest.fn().mockReturnValue(<p>FeedListSeparator</p>);
});

jest.mock('../FeedCardFooter/FeedCardFooter', () => {
  return jest.fn().mockReturnValue(<p>FeedCardFooter</p>);
});

describe('Test ActivityThreadList Component', () => {
  it('Check if it has all child elements', async () => {
    const { container } = render(
      <ActivityThreadList {...mockActivityThreadListProp} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const thread1 = await findByTestId(container, 'thread0');
    const thread2 = await findByTestId(container, 'thread1');

    expect(thread1).toBeInTheDocument();
    expect(thread2).toBeInTheDocument();
  });

  it('Check if thread1 has 0 posts', async () => {
    const { container } = render(
      <ActivityThreadList {...mockActivityThreadListProp} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const thread1 = await findByTestId(container, 'thread0');
    const mainMessage = await findByTestId(thread1, 'main-message');
    const mainMessageReplyButton = await findByTestId(
      thread1,
      'main-message-reply-button'
    );

    const quickReplyButton = queryByTestId(thread1, 'quick-reply-button');
    const repliesContainer = queryByTestId(thread1, 'replies-container');
    const latestReply = queryByTestId(thread1, 'latest-reply');

    expect(thread1).toBeInTheDocument();
    expect(mainMessage).toBeInTheDocument();
    expect(mainMessageReplyButton).toBeInTheDocument();
    expect(quickReplyButton).not.toBeInTheDocument();
    expect(repliesContainer).not.toBeInTheDocument();
    expect(latestReply).not.toBeInTheDocument();
  });

  it('Check if thread2 has 3 posts', async () => {
    const { container } = render(
      <ActivityThreadList {...mockActivityThreadListProp} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const thread2 = await findByTestId(container, 'thread1');
    const mainMessage = await findByTestId(thread2, 'main-message');
    const mainMessageReplyButton = queryByTestId(
      thread2,
      'main-message-reply-button'
    );
    const quickReplyButton = queryByTestId(thread2, 'quick-reply-button');
    const repliesContainer = queryByTestId(thread2, 'replies-container');
    const latestReply = queryByTestId(thread2, 'latest-reply');

    expect(thread2).toBeInTheDocument();
    expect(mainMessage).toBeInTheDocument();
    expect(mainMessageReplyButton).not.toBeInTheDocument();
    expect(quickReplyButton).toBeInTheDocument();
    expect(repliesContainer).toBeInTheDocument();
    expect(latestReply).toBeInTheDocument();
  });

  it('Check if selectedThreadId is equal to thread id', async () => {
    const { container } = render(
      <ActivityThreadList
        {...mockActivityThreadListProp}
        selectedThreadId="40c2faec-0159-4d86-9b15-c17f3e1c081b"
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const thread1 = await findByTestId(container, 'thread0');
    const thread1MainMessage = await findByTestId(thread1, 'main-message');
    const thread1QuickReplyEditor = queryByTestId(
      thread1,
      'quick-reply-editor'
    );
    const thread2 = await findByTestId(container, 'thread1');
    const thread2MainMessage = await findByTestId(thread2, 'main-message');
    const thread2QuickReplyEditor = await findByTestId(
      thread2,
      'quick-reply-editor'
    );

    expect(thread1).toBeInTheDocument();
    expect(thread1MainMessage).toBeInTheDocument();
    expect(thread1QuickReplyEditor).not.toBeInTheDocument();

    expect(thread2).toBeInTheDocument();
    expect(thread2MainMessage).toBeInTheDocument();
    expect(thread2QuickReplyEditor).toBeInTheDocument();
  });
});
