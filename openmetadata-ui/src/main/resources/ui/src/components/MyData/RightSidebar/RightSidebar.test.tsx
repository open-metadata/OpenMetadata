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
import { render, screen } from '@testing-library/react';
import React from 'react';
import RightSidebar from './RightSidebar.component';

describe('RightSidebar', () => {
  it('renders following data container', () => {
    const followedData = [];
    const followedDataCount = 0;
    const isLoadingOwnedData = false;

    render(
      <RightSidebar
        followedData={followedData}
        followedDataCount={followedDataCount}
        isLoadingOwnedData={isLoadingOwnedData}
      />
    );

    const followingDataContainer = screen.getByTestId(
      'following-data-container'
    );

    expect(followingDataContainer).toBeInTheDocument();
  });

  it('renders recently viewed container', () => {
    render(<RightSidebar />);

    const recentlyViewedContainer = screen.getByTestId(
      'recently-viewed-container'
    );

    expect(recentlyViewedContainer).toBeInTheDocument();
  });

  it('renders announcements', async () => {
    const mockAnnouncements = [
      {
        id: 1,
        about: 'About 1',
        createdBy: 'User 1',
        threadTs: '2023-05-20T10:00:00Z',
        announcement: 'Announcement 1',
        message: 'Message 1',
        reactions: [],
      },
      {
        id: 2,
        about: 'About 2',
        createdBy: 'User 2',
        threadTs: '2023-05-21T12:00:00Z',
        announcement: 'Announcement 2',
        message: 'Message 2',
        reactions: [],
      },
    ];

    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockAnnouncements),
    });

    render(<RightSidebar />);

    const announcementItems = await screen.findAllByTestId('announcement-item');

    expect(announcementItems).toHaveLength(mockAnnouncements.length);
  });
});
