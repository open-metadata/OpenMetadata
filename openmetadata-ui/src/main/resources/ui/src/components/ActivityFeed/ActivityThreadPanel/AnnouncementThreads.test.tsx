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

jest.mock('../../../utils/AnnouncementsUtils', () => ({
  isActiveAnnouncement: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../utils/FeedUtils', () => ({
  getFeedListWithRelativeDays: jest.fn().mockReturnValue({
    updatedFeedList: mockThreadData,
    relativeDays: ['Today', 'Yesterday'],
  }),
}));

const mockAnnouncementThreadsProp = {
  threads: mockThreadData,
};

jest.mock('../ActivityFeedCard/ActivityFeedCardV1', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedCardV1</p>);
});

describe('Test AnnouncementThreads Component', () => {
  it('Check if it has all child elements', async () => {
    render(<AnnouncementThreads {...mockAnnouncementThreadsProp} />, {
      wrapper: MemoryRouter,
    });

    const threads = screen.getAllByText('ActivityFeedCardV1');

    expect(threads).toHaveLength(2);
  });
});
