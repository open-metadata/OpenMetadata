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
import {
  findAllByText,
  findByTestId,
  findByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ActivityThread from './ActivityThread';
import { mockThreadData } from './ActivityThread.mock';

const mockActivityThreadProp = {
  selectedThread: mockThreadData[1],
  postFeed: jest.fn(),
  onConfirmation: jest.fn(),
};

jest.mock('../../../axiosAPIs/feedsAPI', () => ({
  getFeedById: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../ActivityFeedCard/ActivityFeedCard', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedCard</p>);
});

jest.mock('../ActivityFeedEditor/ActivityFeedEditor', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedEditor</p>);
});

describe('Test ActivityFeedThread Component', () => {
  it('Check if ActivityThread has all child component', async () => {
    const { container } = render(
      <ActivityThread {...mockActivityThreadProp} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const mainMessage = await findByTestId(container, 'main-message');
    const repliesContainer = await findByTestId(container, 'replies');
    const feedEditor = await findByText(container, /ActivityFeedEditor/i);

    expect(mainMessage).toBeInTheDocument();
    expect(repliesContainer).toBeInTheDocument();
    expect(feedEditor).toBeInTheDocument();
  });

  it('Check if ActivityThread has proper reply count', async () => {
    const { container } = render(
      <ActivityThread {...mockActivityThreadProp} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const repliesContainer = await findByTestId(container, 'replies');
    const replies = await findAllByText(repliesContainer, /FeedCard/i);
    const repliesCount = await findByTestId(repliesContainer, 'replies-count');

    expect(repliesContainer).toBeInTheDocument();
    expect(replies).toHaveLength(mockThreadData[1].posts.length);
    expect(repliesCount).toHaveTextContent(
      `${mockThreadData[1].posts.length} replies`
    );
  });
});
