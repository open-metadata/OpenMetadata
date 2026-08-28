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
import { MemoryRouter } from 'react-router-dom';
import { MOCK_ANNOUNCEMENT_DATA } from '../../mocks/Announcement.mock';
import AnnouncementThreads from './AnnouncementThreads';

const mockAnnouncementThreadsProp = {
  announcements: [
    ...MOCK_ANNOUNCEMENT_DATA.data,
    {
      ...MOCK_ANNOUNCEMENT_DATA.data[0],
      id: 'expired-announcement',
      name: 'expired-announcement',
      startTime: 1,
      endTime: 2,
    },
  ],
  editPermission: true,
  onConfirmation: jest.fn(),
  updateAnnouncementHandler: jest.fn(),
};

jest.mock('./AnnouncementFeedCard.component', () => {
  return jest.fn().mockReturnValue(<p>AnnouncementFeedCard</p>);
});

describe('Test AnnouncementThreads Component', () => {
  it('Check if it has all child elements', async () => {
    render(<AnnouncementThreads {...mockAnnouncementThreadsProp} />, {
      wrapper: MemoryRouter,
    });

    const threads = await screen.findAllByText('AnnouncementFeedCard');

    expect(threads).toHaveLength(2);
  });
});
