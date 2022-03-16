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

import { findByText, render } from '@testing-library/react';
import { Post } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ActivityFeedCard from './ActivityFeedCard';

jest.mock('../../../AppState', () => ({
  userDetails: {
    name: '',
  },
  users: [{ name: '' }],
}));

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: false }),
}));

jest.mock('../../../utils/FeedUtils', () => ({
  getEntityField: jest.fn(),
  getEntityFQN: jest.fn(),
  getEntityType: jest.fn(),
}));

jest.mock('../FeedCardBody/FeedCardBody', () => {
  return jest.fn().mockReturnValue(<p>FeedCardBody</p>);
});
jest.mock('../FeedCardFooter/FeedCardFooter', () => {
  return jest.fn().mockReturnValue(<p>FeedCardFooter</p>);
});
jest.mock('../FeedCardHeader/FeedCardHeader', () => {
  return jest.fn().mockReturnValue(<p>FeedCardHeader</p>);
});

const mockFeedCardProps = {
  feed: {} as Post,
  replies: 0,
  repliedUsers: [],
  entityLink: '',
  isEntityFeed: true,
  threadId: '',
  lastReplyTimeStamp: 1647322547179,
  onThreadSelect: jest.fn(),
  isFooterVisible: false,
  deletePostHandler: jest.fn(),
};

describe('Test ActivityFeedCard Component', () => {
  it('Check if ActivityFeedCard component has all child components', async () => {
    const { container } = render(<ActivityFeedCard {...mockFeedCardProps} />, {
      wrapper: MemoryRouter,
    });
    const feedCardHeader = await findByText(container, /FeedCardHeader/i);
    const feedCardBody = await findByText(container, /FeedCardBody/i);
    const feedCardFooter = await findByText(container, /FeedCardFooter/i);

    expect(feedCardHeader).toBeInTheDocument();
    expect(feedCardBody).toBeInTheDocument();
    expect(feedCardFooter).toBeInTheDocument();
  });
});
