/*
 *  Copyright 2022 Collate.
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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { mockThreadData } from './ActivityThread.mock';
import AnnouncementThreads from './AnnouncementThreads';

jest.mock('../../../utils/FeedUtils', () => ({
  getFeedListWithRelativeDays: jest.fn().mockReturnValue({
    updatedFeedList: mockThreadData,
    relativeDays: ['Today', 'Yesterday'],
  }),
}));

const mockAnnouncementThreadsProp = {
  threads: mockThreadData,
  selectedThreadId: '',
  postFeed: jest.fn(),
  onThreadIdSelect: jest.fn(),
  onThreadSelect: jest.fn(),
  onConfirmation: jest.fn(),
  updateThreadHandler: jest.fn(),
};

jest.mock('../ActivityFeedCard/ActivityFeedCard', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedCard</p>);
});

jest.mock('../ActivityFeedEditor/ActivityFeedEditor', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedEditor</p>);
});

jest.mock('../ActivityFeedCard/FeedCardFooter/FeedCardFooter', () => {
  return jest.fn().mockReturnValue(<p>FeedCardFooter</p>);
});

describe('Test AnnouncementThreads Component', () => {
  it('Check if it has all child elements', async () => {
    render(<AnnouncementThreads {...mockAnnouncementThreadsProp} />, {
      wrapper: MemoryRouter,
    });

    const threads = await screen.findAllByTestId('announcement-card');

    expect(threads).toHaveLength(2);
  });
});
