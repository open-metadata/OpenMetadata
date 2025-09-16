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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { NOTIFICATION_READ_TIMER } from '../../constants/constants';
import { FeedFilter } from '../../enums/mydata.enum';
import { ThreadType } from '../../generated/api/feed/createThread';
import { getFeedsWithFilter } from '../../rest/feedsAPI';
import NotificationBox from './NotificationBox.component';

const mockThread = [
  {
    userId: '011bdb24-90a7-4a97-ba66-24002adb2b12',
    filterType: FeedFilter.ASSIGNED_TO,
    id: '33873393-bd68-46e9-bccc-7701c1c41ad6',
    type: ThreadType.Task,
    threadTs: 1703570590556,
    about: 'test',
    entityId: '6206a003-281c-4984-9728-4e949a4e4023',
    posts: [
      {
        id: '12345',
        message: 'Resolved the Task.',
        postTs: 1703570590652,
        from: 'admin',
        reactions: [],
      },
    ],
    task: {
      id: 6,
      type: 'RequestTestCaseFailureResolution',
      assignees: [
        {
          id: '011bdb24-90a7-4a97-ba66-24002adb2b12',
          type: 'user',
          name: 'aaron_johnson0',
          fullyQualifiedName: 'aaron_johnson0',
          displayName: 'Aaron Johnson',
          deleted: false,
        },
      ],
      status: 'Closed',
      closedBy: 'admin',
      closedAt: 1703570590648,
      newValue: 'Resolution comment',
      testCaseResolutionStatusId: 'f93d08e9-2d38-4d01-a294-f8b44fbb0f4a',
    },
  },
];
const tabList = ['Tasks', 'Mentions'];
const mockShowErrorToast = jest.fn();
const mockOnMarkTaskNotificationRead = jest.fn();

const mockProps = {
  hasMentionNotification: true,
  hasTaskNotification: true,
  onMarkMentionsNotificationRead: jest.fn(),
  onMarkTaskNotificationRead: mockOnMarkTaskNotificationRead,
  onTabChange: jest.fn(),
};

jest.mock('../../rest/feedsAPI', () => ({
  getFeedsWithFilter: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockThread })),
  getFilters: jest.fn().mockImplementation(() => ({
    threadType: ThreadType.Task,
    feedFilter: FeedFilter.ASSIGNED_TO,
  })),
}));

jest.mock('../../utils/FeedUtils', () => ({
  getEntityFQN: jest.fn().mockReturnValue('entityFQN'),
  getEntityType: jest.fn().mockReturnValue('entityType'),
}));

jest.mock('./NotificationFeedCard.component', () => {
  return jest.fn().mockReturnValue(<p>NotificationFeedCard</p>);
});

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockImplementation(() => mockShowErrorToast()),
}));

describe('Test NotificationBox Component', () => {
  it('should render NotificationBox', async () => {
    await act(async () => {
      render(<NotificationBox {...mockProps} />);
    });
    const notificationHeading = await screen.findByTestId(
      'notification-heading'
    );

    expect(notificationHeading).toHaveTextContent('label.notification-plural');
  });

  it('should render tabs', async () => {
    await act(async () => {
      render(<NotificationBox {...mockProps} />);
    });
    const tabs = await screen.findAllByRole('tab');

    expect(tabs).toHaveLength(tabList.length);
  });

  it('should render error toast if any error occurs', async () => {
    (getFeedsWithFilter as jest.Mock).mockRejectedValue(new Error());
    await act(async () => {
      render(<NotificationBox {...mockProps} />);
    });

    expect(mockShowErrorToast).toHaveBeenCalled();
  });

  it('should call onMarkTaskNotificationRead when active tab is changed', async () => {
    jest.useFakeTimers();

    await act(async () => {
      render(<NotificationBox {...mockProps} />);
    });
    const tabs = await screen.findAllByRole('tab');
    await act(async () => {
      fireEvent.click(tabs[0]);
    });
    jest.advanceTimersByTime(NOTIFICATION_READ_TIMER);

    expect(mockOnMarkTaskNotificationRead).toHaveBeenCalled();
  });

  it('should render no data in case of no notification', async () => {
    (getFeedsWithFilter as jest.Mock).mockImplementation(() =>
      Promise.resolve({ data: [] })
    ),
      await act(async () => {
        render(<NotificationBox {...mockProps} />);
      });

    expect(
      await screen.findByText('message.no-notification-found')
    ).toBeInTheDocument();
  });
});
