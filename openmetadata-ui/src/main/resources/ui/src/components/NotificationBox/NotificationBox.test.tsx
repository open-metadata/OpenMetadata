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
import { MemoryRouter } from 'react-router-dom';
import { NOTIFICATION_READ_TIMER } from '../../constants/constants';
import { NotificationTabsKey } from '../../enums/notification.enum';
import {
  Task,
  TaskCategory,
  TaskStatus,
  TaskType,
} from '../../generated/entity/tasks/task';
import { listConversations } from '../../rest/conversationsAPI';
import { listMyAssignedTasks } from '../../rest/tasksAPI';
import NotificationBox from './NotificationBox.component';
import { TaskMentionCard } from './TaskMentionCard';

const mockTask: Task[] = [
  {
    id: '33873393-bd68-46e9-bccc-7701c1c41ad6',
    taskId: 'TASK-00001',
    name: 'approve-test-term',
    type: TaskType.GlossaryApproval,
    category: TaskCategory.Approval,
    status: TaskStatus.Open,
    description: 'Approval required for testTerm',
    about: {
      id: '6206a003-281c-4984-9728-4e949a4e4023',
      type: 'glossaryTerm',
      name: 'testTerm',
      fullyQualifiedName: 'testGlossary.testTerm',
    },
    createdBy: {
      id: '011bdb24-90a7-4a97-ba66-24002adb2b12',
      type: 'user',
      name: 'admin',
    },
    createdAt: 1703570590556,
    assignees: [],
  },
];

const tabList = ['Tasks', 'Mentions'];
const mockShowErrorToast = jest.fn();
const mockOnMarkTaskNotificationRead = jest.fn();

const mockProps = {
  activeTab: NotificationTabsKey.TASK,
  hasMentionNotification: true,
  hasTaskNotification: true,
  onMarkMentionsNotificationRead: jest.fn(),
  onMarkTaskNotificationRead: mockOnMarkTaskNotificationRead,
  onTabChange: jest.fn(),
};

jest.mock('../../rest/tasksAPI', () => ({
  ...jest.requireActual('../../rest/tasksAPI'),
  listMyAssignedTasks: jest.fn(),
}));

jest.mock('../../rest/conversationsAPI', () => ({
  listConversations: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
}));

jest.mock('../../hooks/useDomainStore', () => ({
  useDomainStore: jest.fn((selector) =>
    selector({ activeDomain: 'All Domains' })
  ),
}));

jest.mock('../../utils/FeedUtilsPure', () => ({
  getEntityFQN: jest.fn().mockReturnValue('entityFQN'),
  getEntityType: jest.fn().mockReturnValue('entityType'),
}));

jest.mock('./NotificationFeedCard.component', () => {
  return jest.fn().mockReturnValue(<p>NotificationFeedCard</p>);
});

jest.mock('../common/ProfilePicture/ProfilePicture', () => () => null);

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockImplementation(() => mockShowErrorToast()),
}));

describe('Test NotificationBox Component', () => {
  it('links a test case incident mention to that incident on the Issues tab', () => {
    const task = {
      ...mockTask[0],
      type: TaskType.TestCaseResolution,
      about: {
        id: 'test-case',
        type: 'testCase',
        fullyQualifiedName: 'db.schema.table.case/1',
      },
    };

    render(
      <MemoryRouter>
        <TaskMentionCard
          mention={{
            task,
            comment: {
              id: 'comment-id',
              author: task.createdBy,
              createdAt: 1,
              message: 'Resolved',
            },
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('task-mention-notification')).toHaveAttribute(
      'href',
      `/test-case/db.schema.table.case%2F1/issues?taskId=${task.id}`
    );
  });

  beforeEach(() => {
    jest.mocked(listMyAssignedTasks).mockResolvedValue({
      data: mockTask,
      paging: { total: mockTask.length },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

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
    (listMyAssignedTasks as jest.Mock).mockRejectedValue(new Error());
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
      fireEvent.click(tabs[1]);
    });
    await act(async () => {
      fireEvent.click(tabs[0]);
    });
    jest.advanceTimersByTime(NOTIFICATION_READ_TIMER);

    expect(mockOnMarkTaskNotificationRead).toHaveBeenCalled();
  });

  it('loads mention notifications from Conversation V2', async () => {
    await act(async () => {
      render(<NotificationBox {...mockProps} />);
    });
    const tabs = await screen.findAllByRole('tab');
    await act(async () => fireEvent.click(tabs[1]));

    expect(listConversations).toHaveBeenCalledWith(
      expect.objectContaining({ filterType: 'MENTIONS', limit: 10 })
    );
  });

  it('keeps assigned tasks visible when an earlier Mentions request finishes', async () => {
    type ConversationPage = Awaited<ReturnType<typeof listConversations>>;
    let finishMentions!: (value: ConversationPage) => void;
    jest.mocked(listConversations).mockReturnValueOnce(
      new Promise((resolve) => {
        finishMentions = resolve;
      })
    );
    await act(async () => {
      render(<NotificationBox {...mockProps} />);
    });

    expect(await screen.findByText('NotificationFeedCard')).toBeInTheDocument();

    const tabs = await screen.findAllByRole('tab');
    await act(async () => fireEvent.click(tabs[1]));
    await act(async () => fireEvent.click(tabs[0]));

    expect(await screen.findByText('NotificationFeedCard')).toBeInTheDocument();

    await act(async () => finishMentions({ data: [], paging: { total: 0 } }));

    expect(screen.getByText('NotificationFeedCard')).toBeInTheDocument();
  });

  it('should render no data in case of no notification', async () => {
    (listMyAssignedTasks as jest.Mock).mockImplementation(() =>
      Promise.resolve({ data: [] })
    );
    await act(async () => {
      render(<NotificationBox {...mockProps} />);
    });

    expect(
      await screen.findByText('message.no-notification-found')
    ).toBeInTheDocument();
  });
});
