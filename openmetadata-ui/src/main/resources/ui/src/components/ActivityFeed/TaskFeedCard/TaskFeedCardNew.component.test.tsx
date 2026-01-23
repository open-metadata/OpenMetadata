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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  TASK_FEED,
  TASK_FEED_RECOGNIZER_FEEDBACK,
} from '../../../mocks/Task.mock';
import TaskFeedCard from './TaskFeedCardNew.component';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: jest.fn().mockImplementation(() => ({
    showDrawer: jest.fn(),
    setActiveThread: jest.fn(),
  })),
  __esModule: true,
  default: 'ActivityFeedProvider',
}));

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => ({
    isAdminUser: false,
  })),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: {
      id: 'test-user-id',
      name: 'test-user',
      teams: [],
    },
  })),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: jest.fn().mockImplementation(() => [
    undefined,
    undefined,
    {
      id: 'user-id',
      name: 'admin',
      displayName: 'Admin User',
    },
  ]),
}));

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockReturnValue(<p>OwnerLabel</p>),
}));

jest.mock('../../../components/common/PopOverCard/EntityPopOverCard', () => {
  return jest.fn().mockImplementation(({ children }) => children);
});

jest.mock('../../../components/common/PopOverCard/UserPopOverCard', () => {
  return jest.fn().mockImplementation(({ children }) => children);
});

jest.mock('../../../pages/TasksPage/shared/TagsTask', () => {
  return jest.fn().mockImplementation(() => <p>TagsTask</p>);
});

jest.mock('../../../pages/TasksPage/shared/DescriptionTaskNew', () => {
  return jest.fn().mockImplementation(() => <p>DescriptionTaskNew</p>);
});

jest.mock('../../../utils/TasksUtils', () => ({
  ...jest.requireActual('../../../utils/TasksUtils'),
  getTaskDetailPath: jest.fn().mockReturnValue('/tasks/1'),
  isTagsTask: jest.fn().mockReturnValue(true),
  isDescriptionTask: jest.fn().mockReturnValue(false),
}));

jest.mock('../../../utils/FeedUtils', () => ({
  getEntityFQN: jest.fn().mockReturnValue('entityFQN'),
  getEntityType: jest.fn().mockReturnValue('table'),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockReturnValue('2023-12-04 10:15:27'),
  getRelativeTime: jest.fn().mockReturnValue('2 hours ago'),
  getEpochMillisForPastDays: jest.fn().mockReturnValue(1234567890),
  getCurrentMillis: jest.fn().mockReturnValue(1234567890),
  getStartOfDayInMillis: jest.fn().mockReturnValue(1234567890),
  getEndOfDayInMillis: jest.fn().mockReturnValue(1234567890),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getNameFromFQN: jest.fn().mockReturnValue('Sensitive'),
}));

jest.mock('../../../utils/EntityLink', () => {
  return {
    __esModule: true,
    default: {
      getTableColumnName: jest.fn().mockReturnValue(null),
    },
  };
});

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Admin User'),
}));

jest.mock('../../../rest/feedsAPI', () => ({
  updateTask: jest.fn().mockResolvedValue({}),
}));

const mockProps = {
  feed: TASK_FEED,
  isActive: false,
  isForFeedTab: false,
};

describe('TaskFeedCardNew Component', () => {
  it('should render the component', async () => {
    await act(async () => {
      render(<TaskFeedCard {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('task-feed-card')).toBeInTheDocument();
    expect(screen.getByTestId('task-status-icon-open')).toBeInTheDocument();
    expect(screen.getByTestId('redirect-task-button-link')).toBeInTheDocument();
  });

  it('should display task created by information', async () => {
    await act(async () => {
      render(<TaskFeedCard {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('task-created-by')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  it('should display timestamp', async () => {
    await act(async () => {
      render(<TaskFeedCard {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('timestamp')).toBeInTheDocument();
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
  });

  it('should display TagsTask component for tag tasks', async () => {
    await act(async () => {
      render(<TaskFeedCard {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('TagsTask')).toBeInTheDocument();
  });

  it('should display DescriptionTaskNew component for description tasks', async () => {
    const {
      isTagsTask,
      isDescriptionTask,
    } = require('../../../utils/TasksUtils');
    isTagsTask.mockReturnValue(false);
    isDescriptionTask.mockReturnValue(true);

    await act(async () => {
      render(<TaskFeedCard {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('DescriptionTaskNew')).toBeInTheDocument();
  });

  it('should display approve and reject buttons when user has edit access and suggestion is not empty', async () => {
    const { useAuth } = require('../../../hooks/authHooks');
    useAuth.mockReturnValue({ isAdminUser: true });

    await act(async () => {
      render(<TaskFeedCard {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('approve-button')).toBeInTheDocument();
    expect(screen.getByTestId('reject-button')).toBeInTheDocument();
  });

  it('should handle approve button click', async () => {
    const { updateTask } = require('../../../rest/feedsAPI');
    const { useAuth } = require('../../../hooks/authHooks');
    useAuth.mockReturnValue({ isAdminUser: true });

    await act(async () => {
      render(<TaskFeedCard {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const approveButton = screen.getByTestId('approve-button');
    await act(async () => {
      fireEvent.click(approveButton);
    });

    expect(updateTask).toHaveBeenCalled();
  });

  it('should handle reject button click', async () => {
    const { updateTask } = require('../../../rest/feedsAPI');
    const { useAuth } = require('../../../hooks/authHooks');
    useAuth.mockReturnValue({ isAdminUser: true });

    await act(async () => {
      render(<TaskFeedCard {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const rejectButton = screen.getByTestId('reject-button');
    await act(async () => {
      fireEvent.click(rejectButton);
    });

    expect(updateTask).toHaveBeenCalled();
  });

  it('should display replies count when posts are available', async () => {
    const feedWithPosts = {
      ...TASK_FEED,
      postsCount: 3,
    };

    await act(async () => {
      render(<TaskFeedCard feed={feedWithPosts} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('replies-count')).toBeInTheDocument();
  });

  it('should display recognizer feedback task with tag name', async () => {
    await act(async () => {
      render(<TaskFeedCard feed={TASK_FEED_RECOGNIZER_FEEDBACK} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('redirect-task-button-link')).toBeInTheDocument();
  });

  it('should show approve/reject buttons for recognizer feedback approval task when user is assignee', async () => {
    const {
      useApplicationStore,
    } = require('../../../hooks/useApplicationStore');
    useApplicationStore.mockReturnValue({
      currentUser: {
        id: '31d072f8-7873-4976-88ea-ac0d2f51f632',
        name: 'test-user',
        teams: [
          {
            id: '31d072f8-7873-4976-88ea-ac0d2f51f632',
            name: 'DataGovernance',
          },
        ],
      },
    });

    await act(async () => {
      render(<TaskFeedCard feed={TASK_FEED_RECOGNIZER_FEEDBACK} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('approve-button')).toBeInTheDocument();
    expect(screen.getByTestId('reject-button')).toBeInTheDocument();
  });

  it('should handle recognizer feedback approval', async () => {
    const { updateTask } = require('../../../rest/feedsAPI');
    const {
      useApplicationStore,
    } = require('../../../hooks/useApplicationStore');
    useApplicationStore.mockReturnValue({
      currentUser: {
        id: '31d072f8-7873-4976-88ea-ac0d2f51f632',
        name: 'test-user',
        teams: [
          {
            id: '31d072f8-7873-4976-88ea-ac0d2f51f632',
            name: 'DataGovernance',
          },
        ],
      },
    });

    await act(async () => {
      render(<TaskFeedCard feed={TASK_FEED_RECOGNIZER_FEEDBACK} />, {
        wrapper: MemoryRouter,
      });
    });

    const approveButton = screen.getByTestId('approve-button');
    await act(async () => {
      fireEvent.click(approveButton);
    });

    expect(updateTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        newValue: 'approved',
      })
    );
  });

  it('should handle recognizer feedback rejection', async () => {
    const { updateTask } = require('../../../rest/feedsAPI');
    const {
      useApplicationStore,
    } = require('../../../hooks/useApplicationStore');
    useApplicationStore.mockReturnValue({
      currentUser: {
        id: '31d072f8-7873-4976-88ea-ac0d2f51f632',
        name: 'test-user',
        teams: [
          {
            id: '31d072f8-7873-4976-88ea-ac0d2f51f632',
            name: 'DataGovernance',
          },
        ],
      },
    });

    await act(async () => {
      render(<TaskFeedCard feed={TASK_FEED_RECOGNIZER_FEEDBACK} />, {
        wrapper: MemoryRouter,
      });
    });

    const rejectButton = screen.getByTestId('reject-button');
    await act(async () => {
      fireEvent.click(rejectButton);
    });

    expect(updateTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        newValue: 'Rejected',
      })
    );
  });

  it('should not show approve/reject buttons when suggestion is empty for non-approval tasks', async () => {
    const { useAuth } = require('../../../hooks/authHooks');
    const feedWithEmptySuggestion = {
      ...TASK_FEED,
      task: {
        ...TASK_FEED.task!,
        suggestion: '[]',
      },
    };

    useAuth.mockReturnValue({ isAdminUser: true });

    await act(async () => {
      render(<TaskFeedCard feed={feedWithEmptySuggestion} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.queryByTestId('approve-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument();
  });
});
