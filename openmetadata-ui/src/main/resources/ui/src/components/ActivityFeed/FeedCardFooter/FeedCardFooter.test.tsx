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
  findAllByTestId,
  findByTestId,
  queryAllByTestId,
  queryByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import FeedCardFooter from './FeedCardFooter';

jest.mock('../../../utils/FeedUtils', () => ({
  getReplyText: jest.fn(),
}));

jest.mock('../../../utils/TimeUtils', () => ({
  getDayTimeByTimeStamp: jest.fn(),
}));

jest.mock('../../common/avatar/Avatar', () => {
  return jest.fn().mockReturnValue(<p data-testid="replied-user">Avatar</p>);
});

const mockFeedCardFooterPorps = {
  repliedUsers: ['xyz', 'pqr'],
  replies: 2,
  threadId: 'id1',
  onThreadSelect: jest.fn(),
  lastReplyTimeStamp: 1647322547179,
  isFooterVisible: true,
};

describe('Test FeedCardFooter component', () => {
  it('Check if FeedCardFooter has all child elements', async () => {
    const { container } = render(
      <FeedCardFooter {...mockFeedCardFooterPorps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const repliedUsers = await findAllByTestId(container, 'replied-user');
    const replyCount = await findByTestId(container, 'reply-count');
    const lastReply = await findByTestId(container, 'last-reply');

    expect(repliedUsers).toHaveLength(2);
    expect(replyCount).toBeInTheDocument();
    expect(lastReply).toBeInTheDocument();
  });

  it('Check if FeedCardFooter has isFooterVisible as false', async () => {
    const { container } = render(
      <FeedCardFooter {...mockFeedCardFooterPorps} isFooterVisible={false} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const repliedUsers = queryAllByTestId(container, 'replied-user');
    const replyCount = queryByTestId(container, 'reply-count');
    const lastReply = queryByTestId(container, 'last-reply');

    expect(repliedUsers).toHaveLength(0);
    expect(replyCount).not.toBeInTheDocument();
    expect(lastReply).not.toBeInTheDocument();
  });

  it('Check if FeedCardFooter has repliedUsers as undefined', async () => {
    const { container } = render(
      <FeedCardFooter {...mockFeedCardFooterPorps} repliedUsers={undefined} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const repliedUsers = queryAllByTestId(container, 'replied-user');
    const replyCount = queryByTestId(container, 'reply-count');
    const lastReply = queryByTestId(container, 'last-reply');

    expect(repliedUsers).toHaveLength(0);
    expect(replyCount).not.toBeInTheDocument();
    expect(lastReply).not.toBeInTheDocument();
  });

  it('Check if FeedCardFooter has replies as undefined', async () => {
    const { container } = render(
      <FeedCardFooter {...mockFeedCardFooterPorps} replies={undefined} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const repliedUsers = queryAllByTestId(container, 'replied-user');
    const replyCount = queryByTestId(container, 'reply-count');
    const lastReply = queryByTestId(container, 'last-reply');

    expect(repliedUsers).toHaveLength(0);
    expect(replyCount).not.toBeInTheDocument();
    expect(lastReply).not.toBeInTheDocument();
  });

  it('Check if FeedCardFooter has lastReplyTimeStamp as undefined and replies as 0', async () => {
    const { container } = render(
      <FeedCardFooter
        {...mockFeedCardFooterPorps}
        lastReplyTimeStamp={undefined}
        replies={0}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const repliedUsers = queryAllByTestId(container, 'replied-user');
    const replyCount = queryByTestId(container, 'reply-count');
    const lastReply = queryByTestId(container, 'last-reply');

    expect(repliedUsers).toHaveLength(2);
    expect(replyCount).toBeInTheDocument();
    expect(lastReply).not.toBeInTheDocument();
  });
});
