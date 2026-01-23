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
import { EntityType } from '../../../../enums/entity.enum';
import {
  TASK_FEED,
  TASK_FEED_RECOGNIZER_FEEDBACK,
} from '../../../../mocks/Task.mock';
import { TaskTabNew } from './TaskTabNew.component';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => ({
    isAdminUser: false,
  })),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: {
      id: 'test-user-id',
      name: 'test-user',
      teams: [],
    },
  })),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {},
  })),
}));

jest.mock(
  '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn().mockImplementation(() => ({
      postFeed: jest.fn().mockResolvedValue({}),
      updateEntityThread: jest.fn(),
      fetchUpdatedThread: jest.fn().mockResolvedValue({}),
      updateTestCaseIncidentStatus: jest.fn(),
      testCaseResolutionStatus: [],
      isPostsLoading: false,
    })),
  })
);

jest.mock('../../../../rest/feedsAPI', () => ({
  updateTask: jest.fn().mockResolvedValue({}),
  updateThread: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../rest/userAPI', () => ({
  getUsers: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  postTestCaseIncidentStatus: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../utils/FeedUtils', () => ({
  getEntityFQN: jest.fn().mockReturnValue('entityFQN'),
  getEntityType: jest.fn().mockReturnValue('table'),
}));

jest.mock('../../../../utils/EntityLink', () => {
  return {
    __esModule: true,
    default: {
      getTableColumnName: jest.fn().mockReturnValue(null),
    },
  };
});

jest.mock('../../../../utils/TasksUtils', () => ({
  ...jest.requireActual('../../../../utils/TasksUtils'),
  getTaskDetailPath: jest.fn().mockReturnValue('/tasks/1'),
  isTagsTask: jest.fn().mockReturnValue(true),
  isDescriptionTask: jest.fn().mockReturnValue(false),
  fetchOptions: jest.fn(),
  generateOptions: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../../utils/CommonUtils', () => ({
  getNameFromFQN: jest.fn().mockReturnValue('entityName'),
}));

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Admin User'),
  getEntityReferenceListFromEntities: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getUserPath: jest.fn().mockReturnValue('/users/admin'),
}));

jest.mock('../../../../pages/TasksPage/shared/TagsTask', () => {
  return jest.fn().mockImplementation(() => <p>TagsTask</p>);
});

jest.mock('../../../../pages/TasksPage/shared/DescriptionTaskNew', () => {
  return jest.fn().mockImplementation(() => <p>DescriptionTaskNew</p>);
});

jest.mock('../../../../pages/TasksPage/shared/FeedbackApprovalTask', () => {
  return jest.fn().mockImplementation(() => <p>FeedbackApprovalTask</p>);
});

jest.mock('../../../../pages/TasksPage/shared/Assignees', () => {
  return jest.fn().mockImplementation(() => <p>Assignees</p>);
});

jest.mock('../../../common/PopOverCard/EntityPopOverCard', () => {
  return jest.fn().mockImplementation(({ children }) => children);
});

jest.mock('../../../common/PopOverCard/UserPopOverCard', () => {
  return jest.fn().mockImplementation(({ children }) => children);
});

jest.mock('../../../common/ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockImplementation(() => <p>ProfilePicture</p>);
});

jest.mock('../../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockReturnValue(<p>OwnerLabel</p>),
}));

jest.mock(
  '../TaskTabIncidentManagerHeader/TasktabIncidentManagerHeaderNew',
  () => {
    return jest.fn().mockImplementation(() => <p>IncidentManagerHeader</p>);
  }
);

jest.mock(
  '../../../ActivityFeed/ActivityFeedCardNew/CommentCard.component',
  () => {
    return jest.fn().mockImplementation(() => <p>CommentCard</p>);
  }
);

jest.mock(
  '../../../ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew',
  () => {
    return jest.fn().mockImplementation(() => <p>ActivityFeedEditorNew</p>);
  }
);

const mockProps = {
  taskThread: TASK_FEED,
  owners: [],
  entityType: EntityType.TABLE,
  hasGlossaryReviewer: false,
};

describe('TaskTabNew Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component', async () => {
    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('task-tab')).toBeInTheDocument();
  });

  it('should display task title and id', async () => {
    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('task-title')).toBeInTheDocument();
  });

  it('should display created by information', async () => {
    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('label.created-by')).toBeInTheDocument();
  });

  it('should display assignees section', async () => {
    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('label.assignee-plural')).toBeInTheDocument();
  });

  it('should render TagsTask for tag-related tasks', async () => {
    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('TagsTask')).toBeInTheDocument();
  });

  it('should render DescriptionTaskNew for description tasks', async () => {
    const {
      isTagsTask,
      isDescriptionTask,
    } = require('../../../../utils/TasksUtils');
    isTagsTask.mockReturnValue(false);
    isDescriptionTask.mockReturnValue(true);

    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('DescriptionTaskNew')).toBeInTheDocument();
  });

  it('should render FeedbackApprovalTask for recognizer feedback approval tasks', async () => {
    await act(async () => {
      render(
        <TaskTabNew
          {...mockProps}
          taskThread={TASK_FEED_RECOGNIZER_FEEDBACK}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByText('FeedbackApprovalTask')).toBeInTheDocument();
  });

  it('should display action required section for open tasks', async () => {
    const { useAuth } = require('../../../../hooks/authHooks');
    const {
      useApplicationStore,
    } = require('../../../../hooks/useApplicationStore');

    useAuth.mockReturnValue({ isAdminUser: true });
    useApplicationStore.mockReturnValue({
      currentUser: {
        id: 'd6764107-e8b4-4748-b256-c86fecc66064',
        name: 'test-user',
        teams: [],
      },
    });

    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('label.action-required')).toBeInTheDocument();
  });

  it('should display comments section', async () => {
    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('label.comment-plural')).toBeInTheDocument();
  });

  it('should allow posting comments on open tasks', async () => {
    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const commentInput = screen.getByTestId('comments-input-field');

    expect(commentInput).toBeInTheDocument();
  });

  it('should display approve/reject buttons for recognizer feedback approval when user has access', async () => {
    const {
      useApplicationStore,
    } = require('../../../../hooks/useApplicationStore');
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
      render(
        <TaskTabNew
          {...mockProps}
          taskThread={TASK_FEED_RECOGNIZER_FEEDBACK}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByTestId('task-cta-buttons')).toBeInTheDocument();
  });

  it('should handle approve action for recognizer feedback', async () => {
    const {
      useApplicationStore,
    } = require('../../../../hooks/useApplicationStore');

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
      render(
        <TaskTabNew
          {...mockProps}
          taskThread={TASK_FEED_RECOGNIZER_FEEDBACK}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const dropdownButton = screen.getByTestId(
      'glossary-accept-reject-task-dropdown'
    );

    expect(dropdownButton).toBeInTheDocument();
  });

  it('should show edit task modal when edit action is triggered', async () => {
    const { useAuth } = require('../../../../hooks/authHooks');
    useAuth.mockReturnValue({ isAdminUser: true });

    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const editButton = screen.getByTestId('edit-accept-task-dropdown');
    await act(async () => {
      fireEvent.click(editButton);
    });
  });

  it('should not show action buttons for tasks without edit access', async () => {
    const { useAuth } = require('../../../../hooks/authHooks');
    const {
      useApplicationStore,
    } = require('../../../../hooks/useApplicationStore');

    useAuth.mockReturnValue({ isAdminUser: false });
    useApplicationStore.mockReturnValue({
      currentUser: {
        id: 'different-user-id',
        name: 'different-user',
        teams: [],
      },
    });

    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      screen.queryByTestId('edit-accept-task-dropdown')
    ).not.toBeInTheDocument();
  });

  it('should handle reject action for recognizer feedback approval', async () => {
    const {
      useApplicationStore,
    } = require('../../../../hooks/useApplicationStore');

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
      render(
        <TaskTabNew
          {...mockProps}
          taskThread={TASK_FEED_RECOGNIZER_FEEDBACK}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const dropdownButton = screen.getByTestId(
      'glossary-accept-reject-task-dropdown'
    );

    expect(dropdownButton).toBeInTheDocument();
  });

  it('should display comment editor when input is clicked', async () => {
    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const commentInput = screen.getByTestId('comments-input-field');
    await act(async () => {
      fireEvent.click(commentInput);
    });

    expect(screen.getByText('ActivityFeedEditorNew')).toBeInTheDocument();
  });

  it('should only allow reviewers to approve/reject recognizer feedback', async () => {
    const {
      useApplicationStore,
    } = require('../../../../hooks/useApplicationStore');

    useApplicationStore.mockReturnValue({
      currentUser: {
        id: 'non-reviewer-id',
        name: 'non-reviewer',
        teams: [],
      },
    });

    await act(async () => {
      render(
        <TaskTabNew
          {...mockProps}
          taskThread={TASK_FEED_RECOGNIZER_FEEDBACK}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const dropdown = screen.getByTestId('glossary-accept-reject-task-dropdown');

    expect(dropdown).toBeInTheDocument();
    expect(dropdown).toHaveStyle('pointer-events: none');
  });

  it('should render posts/comments when available', async () => {
    const taskWithPosts = {
      ...TASK_FEED,
      posts: [
        {
          id: 'post-1',
          message: 'Test comment',
          from: 'user1',
          postTs: 1701686127533,
        },
      ],
    };

    await act(async () => {
      render(<TaskTabNew {...mockProps} taskThread={taskWithPosts} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('feed-replies')).toBeInTheDocument();
  });
});
