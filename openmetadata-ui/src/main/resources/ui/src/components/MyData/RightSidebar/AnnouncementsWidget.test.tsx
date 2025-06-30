/*
 *  Copyright 2024 Collate.
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
import { act, render, screen } from '@testing-library/react';
import { TaskType, ThreadType } from '../../../generated/api/feed/createThread';
import AnnouncementsWidget from './AnnouncementsWidget';

const mockAnnouncementData = [
  {
    id: 'f0761441-478e-4373-919e-70b8f587c43f',
    type: ThreadType.Announcement,
    href: 'http://localhost:8585/api/v1/feed/f0761441-478e-4373-919e-70b8f587c43f',
    threadTs: 1707475672423,
    about: '<#E::tableu>',
    entityId: '07f9dc02-9cbd-447c-9fc9-988c419a45e0',
    updatedAt: 1707475792808,
    resolved: true,
    message: 'wertyui',
    announcement: {
      description: 'description',
      startTime: 1707475665,
      endTime: 1707648467,
    },
    task: {
      id: 1,
      assignees: [
        {
          id: '1',
          type: 'user',
        },
      ],
      type: TaskType.RequestDescription,
    },
  },
];

jest.mock(
  '../../ActivityFeed/ActivityFeedCard/FeedCardBody/FeedCardBodyV1',
  () => {
    return jest.fn().mockImplementation(() => <div>FeedCardBodyV1</div>);
  }
);

jest.mock(
  '../../ActivityFeed/ActivityFeedCardV2/FeedCardHeader/FeedCardHeaderV2',
  () => {
    return jest.fn().mockImplementation(() => <div>FeedCardHeaderV2</div>);
  }
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockReturnValue(<div>ErrorPlaceHolder</div>)
);

describe('AnnouncementsWidget', () => {
  it('should render Announcements Widget', () => {
    const { container } = render(<AnnouncementsWidget widgetKey="testKey" />);

    expect(container).toBeTruthy();
  });

  it('should render loading state', () => {
    render(<AnnouncementsWidget isAnnouncementLoading widgetKey="testKey" />);

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });

  it('should render empty state', () => {
    render(<AnnouncementsWidget announcements={[]} widgetKey="testKey" />);

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('should render announcements', async () => {
    await act(async () => {
      render(
        <AnnouncementsWidget
          announcements={mockAnnouncementData}
          widgetKey="testKey"
        />
      );
    });

    expect(screen.getByText('FeedCardBodyV1')).toBeInTheDocument();
    expect(screen.getByText('FeedCardHeaderV2')).toBeInTheDocument();
    expect(screen.getByText('label.announcement')).toBeInTheDocument();
  });
});
