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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import {
  Task,
  TaskCategory,
  TaskEntityStatus,
  TaskEntityType,
  TaskPriority,
  TaskResolutionType,
} from '../../../../rest/tasksAPI';
import { TaskTabNew } from './TaskTabNew.component';

const MOCK_TASK: Task = {
  id: '8b5076bb-8284-46b0-b00d-5e43a184ba9b',
  taskId: 'TASK-00002',
  name: 'RequestTag-dim.shop-shop_id',
  category: TaskCategory.MetadataUpdate,
  type: TaskEntityType.TagUpdate,
  status: TaskEntityStatus.Open,
  priority: TaskPriority.Medium,
  about: {
    id: 'table-id-1',
    type: 'table',
    name: 'dim.shop',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.shop"',
  },
  createdBy: {
    id: 'admin-user-id',
    type: 'user',
    name: 'admin',
    displayName: 'Admin User',
  },
  assignees: [
    {
      id: 'd6764107-e8b4-4748-b256-c86fecc66064',
      type: 'team',
      name: 'Sales',
      fullyQualifiedName: 'Sales',
      deleted: false,
    },
  ],
  payload: {
    field: 'tags',
    fieldPath: 'columns::shop_id::tags',
    currentValue: '[]',
    suggestedValue: JSON.stringify([
      {
        tagFQN: 'PersonalData.SpecialCategory',
        source: 'Classification',
        name: 'SpecialCategory',
        description:
          'GDPR special category data is personal information of data subjects that is especially sensitive.',
      },
    ]),
  },
  comments: [],
  commentCount: 0,
};

const MOCK_TASK_RECOGNIZER_FEEDBACK: Task = {
  id: 'feedback-8b5076bb-8284-46b0-b00d-5e43a184ba9b',
  taskId: 'TASK-00004',
  name: 'RecognizerFeedbackApproval-dim.shop-email',
  category: TaskCategory.Review,
  type: TaskEntityType.TagUpdate,
  status: TaskEntityStatus.Open,
  priority: TaskPriority.Medium,
  about: {
    id: 'table-id-2',
    type: 'table',
    name: 'dim.shop',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.shop"',
  },
  createdBy: {
    id: 'admin-user-id',
    type: 'user',
    name: 'admin',
    displayName: 'Admin User',
  },
  assignees: [
    {
      id: '31d072f8-7873-4976-88ea-ac0d2f51f632',
      type: 'team',
      name: 'DataGovernance',
      fullyQualifiedName: 'DataGovernance',
      deleted: false,
    },
  ],
  payload: {
    field: 'tags',
    fieldPath: 'columns::email',
    suggestedValue:
      '[{"tagFQN":"PII.Sensitive","source":"Classification","name":"Sensitive"}]',
    currentValue: '[]',
    feedback: {
      entityLink:
        '<#E::table::sample_data.ecommerce_db.shopify."dim.shop"::columns::email>',
      feedbackType: 'FalsePositive',
      tagFQN: 'PII.Sensitive',
      userComments: 'This is not a sensitive field',
      createdBy: {
        id: 'd6764107-e8b4-4748-b256-c86fecc66064',
        type: 'user',
        name: 'admin',
        displayName: 'Admin User',
        deleted: false,
      },
      createdAt: 1701686127533,
    },
  } as Task['payload'],
  comments: [],
  commentCount: 0,
};

const MOCK_INCIDENT_TASK: Task = {
  id: 'incident-8b5076bb-8284-46b0-b00d-5e43a184ba9b',
  taskId: 'TASK-00005',
  name: 'TestCaseResolution-dim.shop',
  category: TaskCategory.Incident,
  type: TaskEntityType.TestCaseResolution,
  status: TaskEntityStatus.Open,
  priority: TaskPriority.Medium,
  about: {
    id: 'test-case-id-1',
    type: 'testCase',
    name: 'table_row_count',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify."dim.shop".table_row_count',
  },
  createdBy: {
    id: 'admin-user-id',
    type: 'user',
    name: 'admin',
    displayName: 'Admin User',
  },
  assignees: [
    {
      id: 'test-user-id',
      type: 'user',
      name: 'test-user',
      displayName: 'Test User',
      deleted: false,
    },
  ],
  payload: {
    field: 'testCaseStatus',
    testCaseResolutionStatusId: 'resolution-status-id',
  } as Task['payload'],
  comments: [],
  commentCount: 0,
};

const MOCK_CUSTOM_TASK: Task = {
  id: 'custom-task-8b5076bb-8284-46b0-b00d-5e43a184ba9b',
  taskId: 'TASK-00006',
  name: 'CustomTask-dim.shop-description',
  category: TaskCategory.Custom,
  type: TaskEntityType.CustomTask,
  status: TaskEntityStatus.Open,
  priority: TaskPriority.Medium,
  about: {
    id: 'table-id-3',
    type: 'table',
    name: 'dim.shop',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify."dim.shop"',
  },
  createdBy: {
    id: 'admin-user-id',
    type: 'user',
    name: 'admin',
    displayName: 'Admin User',
  },
  assignees: [
    {
      id: 'test-user-id',
      type: 'user',
      name: 'test-user',
      displayName: 'Test User',
      deleted: false,
    },
  ],
  payload: {
    targetField: 'description',
    proposedText: 'Custom description proposal',
    reviewNotes: 'Needs final verification',
  } as Task['payload'],
  comments: [],
  commentCount: 0,
};

const MOCK_WORKFLOW_TASK: Task = {
  ...MOCK_CUSTOM_TASK,
  id: 'workflow-task-123',
  taskId: 'TASK-00999',
  status: TaskEntityStatus.Pending,
  workflowStageId: 'pending-review',
  workflowStageDisplayName: 'Pending Review',
  availableTransitions: [
    {
      id: 'startProgress',
      label: 'Start Progress',
      targetStageId: 'in-progress',
      targetTaskStatus: TaskEntityStatus.InProgress,
      resolutionType: TaskResolutionType.Approved,
      requiresComment: false,
    },
  ],
};

const MOCK_APPROVAL_TASK: Task = {
  id: 'approval-4569705b-78b9-448f-8d1a-060401f03d9d',
  taskId: 'TASK-01803',
  name: 'RequestApproval-v_incnet_location-location_id',
  category: TaskCategory.Approval,
  type: TaskEntityType.RequestApproval,
  status: TaskEntityStatus.Open,
  priority: TaskPriority.Medium,
  description: 'this is a test, I am a very good programmer',
  about: {
    id: '1bf67076-346e-46a6-b7ad-4914d89f7a3a',
    type: 'table',
    name: 'v_incnet_location',
    fullyQualifiedName: 'starburst.cdl.sharp_incnet.v_incnet_location',
    displayName: 'v_incnet_location',
  },
  createdBy: {
    id: 'creator-id',
    type: 'user',
    name: 'calebknight',
    displayName: 'Caleb Knight',
  },
  assignees: [
    {
      id: 'ce782180-36f6-4d4a-9fbe-ee6103d4146f',
      type: 'user',
      name: 'calebknight',
      fullyQualifiedName: 'calebknight',
      displayName: 'Caleb Knight',
      deleted: false,
    },
  ],
  payload: {
    field: 'description',
    currentValue: 'this is a test suggestion',
    suggestedValue: 'this is a different test suggestion2',
  } as Task['payload'],
  comments: [],
  commentCount: 0,
};

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

jest.mock('../../../../utils/TaskFormSchemaUtils', () => {
  const actual = jest.requireActual('../../../../utils/TaskFormSchemaUtils');

  return {
    ...actual,
    getResolvedTaskFormSchema: jest
      .fn()
      .mockImplementation((taskType, taskCategory) =>
        Promise.resolve(actual.getDefaultTaskFormSchema(taskType, taskCategory))
      ),
  };
});

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
      updateTask: jest.fn(),
      fetchUpdatedThread: jest.fn().mockResolvedValue({}),
      updateTestCaseIncidentStatus: jest.fn(),
      testCaseResolutionStatus: [],
      isPostsLoading: false,
    })),
  })
);

jest.mock('../../../../rest/tasksAPI', () => ({
  ...jest.requireActual('../../../../rest/tasksAPI'),
  resolveTask: jest.fn().mockResolvedValue({}),
  closeTask: jest.fn().mockResolvedValue({}),
  patchTask: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../rest/userAPI', () => ({
  getUsers: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  postTestCaseIncidentStatus: jest.fn().mockResolvedValue({}),
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
  getTaskDetailPathFromTask: jest.fn().mockReturnValue('/tasks/1'),
  isTagsTaskType: jest.fn().mockReturnValue(true),
  isDescriptionTaskType: jest.fn().mockReturnValue(false),
  isRecognizerFeedbackTask: jest.fn().mockReturnValue(false),
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

jest.mock('../../../../pages/TasksPage/shared/TagsTaskFromTask', () => {
  return jest.fn().mockImplementation(() => <p>TagsTask</p>);
});

jest.mock('../../../../pages/TasksPage/shared/DescriptionTaskFromTask', () => {
  return jest.fn().mockImplementation(() => <p>DescriptionTaskFromTask</p>);
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

jest.mock('../../../common/IconButtons/EditIconButton', () => ({
  EditIconButton: jest.fn().mockImplementation(({ onClick, ...props }) => (
    <button type="button" onClick={onClick} {...props}>
      EditIconButton
    </button>
  )),
}));

jest.mock(
  '../TaskTabIncidentManagerHeader/TasktabIncidentManagerHeaderNewFromTask',
  () => {
    return jest.fn().mockImplementation(() => <p>IncidentManagerHeader</p>);
  }
);

jest.mock(
  '../../../ActivityFeed/ActivityFeedCardNew/TaskCommentCard.component',
  () => {
    return jest.fn().mockImplementation(() => <p>TaskCommentCard</p>);
  }
);

jest.mock(
  '../../../ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew',
  () => {
    return jest.fn().mockImplementation(() => <p>ActivityFeedEditorNew</p>);
  }
);

jest.mock('../../../common/InlineEdit/InlineEdit.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children }) => children),
}));

const mockProps = {
  task: MOCK_TASK,
  owners: [],
  entityType: EntityType.TABLE,
  hasGlossaryReviewer: false,
};

describe('TaskTabNew Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useAuth } = require('../../../../hooks/authHooks');
    const {
      useApplicationStore,
    } = require('../../../../hooks/useApplicationStore');
    const {
      getResolvedTaskFormSchema,
    } = require('../../../../utils/TaskFormSchemaUtils');
    const {
      isTagsTaskType,
      isDescriptionTaskType,
      isRecognizerFeedbackTask,
    } = require('../../../../utils/TasksUtils');
    const actualTaskFormSchemaUtils = jest.requireActual(
      '../../../../utils/TaskFormSchemaUtils'
    );

    useAuth.mockReturnValue({ isAdminUser: false });
    useApplicationStore.mockReturnValue({
      currentUser: {
        id: 'test-user-id',
        name: 'test-user',
        teams: [],
      },
    });
    getResolvedTaskFormSchema.mockImplementation((taskType, taskCategory) =>
      Promise.resolve(
        actualTaskFormSchemaUtils.getDefaultTaskFormSchema(
          taskType,
          taskCategory
        )
      )
    );
    isTagsTaskType.mockReturnValue(true);
    isDescriptionTaskType.mockReturnValue(false);
    isRecognizerFeedbackTask.mockReturnValue(false);
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
    expect(screen.getByTestId('task-title')).toHaveTextContent('#2');
    expect(screen.getByTestId('task-title')).not.toHaveTextContent(
      '#TASK-00002'
    );
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

  it('should expose assignee edit action for editable single-assignee tasks', async () => {
    const { useAuth } = require('../../../../hooks/authHooks');
    useAuth.mockReturnValue({ isAdminUser: true });

    const singleAssigneeTask: Task = {
      ...MOCK_TASK,
      assignees: [
        {
          id: 'single-assignee-id',
          type: 'user',
          name: 'single-assignee',
          displayName: 'Single Assignee',
          deleted: false,
        },
      ],
    };

    await act(async () => {
      render(<TaskTabNew {...mockProps} task={singleAssigneeTask} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('edit-assignees')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-assignees'));
    });

    expect(screen.getByText('Assignees')).toBeInTheDocument();
  });

  it('should render schema-driven tag payload details for tag-related tasks', async () => {
    await act(async () => {
      render(<TaskTabNew {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('task-payload-details')).toBeInTheDocument();
    expect(
      screen.getByText('PersonalData.SpecialCategory')
    ).toBeInTheDocument();
  });

  it('should render schema-driven description payload details for description tasks', async () => {
    const {
      isTagsTaskType,
      isDescriptionTaskType,
    } = require('../../../../utils/TasksUtils');
    isTagsTaskType.mockReturnValue(false);
    isDescriptionTaskType.mockReturnValue(true);

    const descriptionTask: Task = {
      ...MOCK_TASK,
      type: TaskEntityType.DescriptionUpdate,
      payload: {
        field: 'description',
        currentValue: 'Old description',
        suggestedValue: 'New description',
      },
    };

    await act(async () => {
      render(<TaskTabNew {...mockProps} task={descriptionTask} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('task-payload-details')).toBeInTheDocument();
    expect(screen.getByText('Old description')).toBeInTheDocument();
    expect(screen.getByText('New description')).toBeInTheDocument();
  });

  it('should render FeedbackApprovalTask for recognizer feedback approval tasks', async () => {
    const {
      isRecognizerFeedbackTask,
    } = require('../../../../utils/TasksUtils');
    isRecognizerFeedbackTask.mockReturnValue(true);

    await act(async () => {
      render(
        <TaskTabNew {...mockProps} task={MOCK_TASK_RECOGNIZER_FEEDBACK} />,
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
    const {
      isRecognizerFeedbackTask,
    } = require('../../../../utils/TasksUtils');

    isRecognizerFeedbackTask.mockReturnValue(true);

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
        <TaskTabNew {...mockProps} task={MOCK_TASK_RECOGNIZER_FEEDBACK} />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByTestId('task-cta-buttons')).toBeInTheDocument();
  });

  it('should default assigned incident tasks to reassign even before incident status is loaded', async () => {
    await act(async () => {
      render(
        <TaskTabNew
          {...mockProps}
          entityType={EntityType.TEST_CASE}
          task={MOCK_INCIDENT_TASK}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(
      screen.getByTestId('incident-task-action-primary')
    ).toHaveTextContent('label.re-assign');
  });

  it('should resolve task form schema for approval tasks as well', async () => {
    const {
      getResolvedTaskFormSchema,
    } = require('../../../../utils/TaskFormSchemaUtils');

    await act(async () => {
      render(<TaskTabNew {...mockProps} task={MOCK_APPROVAL_TASK} />, {
        wrapper: MemoryRouter,
      });
    });

    await waitFor(() => {
      expect(getResolvedTaskFormSchema).toHaveBeenCalledWith(
        MOCK_APPROVAL_TASK.type,
        MOCK_APPROVAL_TASK.category
      );
    });
  });

  it('should handle approve action for recognizer feedback', async () => {
    const {
      useApplicationStore,
    } = require('../../../../hooks/useApplicationStore');
    const {
      isRecognizerFeedbackTask,
    } = require('../../../../utils/TasksUtils');

    isRecognizerFeedbackTask.mockReturnValue(true);

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
        <TaskTabNew {...mockProps} task={MOCK_TASK_RECOGNIZER_FEEDBACK} />,
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
    const {
      isRecognizerFeedbackTask,
    } = require('../../../../utils/TasksUtils');

    isRecognizerFeedbackTask.mockReturnValue(true);

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
        <TaskTabNew {...mockProps} task={MOCK_TASK_RECOGNIZER_FEEDBACK} />,
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
    const {
      isRecognizerFeedbackTask,
    } = require('../../../../utils/TasksUtils');

    isRecognizerFeedbackTask.mockReturnValue(true);

    useApplicationStore.mockReturnValue({
      currentUser: {
        id: 'non-reviewer-id',
        name: 'non-reviewer',
        teams: [],
      },
    });

    await act(async () => {
      render(
        <TaskTabNew {...mockProps} task={MOCK_TASK_RECOGNIZER_FEEDBACK} />,
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
    const taskWithComments: Task = {
      ...MOCK_TASK,
      comments: [
        {
          id: 'comment-1',
          message: 'Test comment',
          author: {
            id: 'user-1',
            type: 'user',
            name: 'user1',
          },
          createdAt: 1701686127533,
        },
      ],
    };

    await act(async () => {
      render(<TaskTabNew {...mockProps} task={taskWithComments} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('feed-replies')).toBeInTheDocument();
  });

  it('should display the task information for approval tasks with suggestion data', async () => {
    const {
      isTagsTaskType,
      isDescriptionTaskType,
    } = require('../../../../utils/TasksUtils');
    isTagsTaskType.mockReturnValue(false);
    isDescriptionTaskType.mockReturnValue(false);

    await act(async () => {
      render(<TaskTabNew {...mockProps} task={MOCK_APPROVAL_TASK} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      screen.getByText('message.request-approval-message')
    ).toBeInTheDocument();
    expect(screen.getByTestId('entity-link')).toHaveTextContent('entityName');
    expect(screen.getByText('label.created-by')).toBeInTheDocument();
    expect(screen.getByText('label.assignee-plural')).toBeInTheDocument();
  });

  it('renders schema-driven payload details for custom tasks', async () => {
    const {
      getResolvedTaskFormSchema,
    } = require('../../../../utils/TaskFormSchemaUtils');

    getResolvedTaskFormSchema.mockResolvedValueOnce({
      name: 'CustomTask',
      taskType: TaskEntityType.CustomTask,
      taskCategory: TaskCategory.Custom,
      formSchema: {
        type: 'object',
        properties: {
          targetField: { type: 'string', title: 'Target Field' },
          proposedText: { type: 'string', title: 'Proposed Text' },
          reviewNotes: { type: 'string', title: 'Review Notes' },
        },
      },
      uiSchema: {
        'ui:handler': {
          type: 'descriptionUpdate',
          fieldPathField: 'targetField',
          valueField: 'proposedText',
        },
        'ui:resolution': {
          mode: 'payload',
        },
        targetField: { 'ui:widget': 'hidden' },
        reviewNotes: { 'ui:widget': 'textarea' },
      },
    });

    await act(async () => {
      render(<TaskTabNew {...mockProps} task={MOCK_CUSTOM_TASK} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('task-payload-details')).toBeInTheDocument();
    expect(screen.getByText('Custom description proposal')).toBeInTheDocument();
    expect(screen.getByText('Needs final verification')).toBeInTheDocument();
  });

  it('submits schema-driven payload when resolving a custom task', async () => {
    const { useAuth } = require('../../../../hooks/authHooks');
    const {
      getResolvedTaskFormSchema,
    } = require('../../../../utils/TaskFormSchemaUtils');
    const { resolveTask } = require('../../../../rest/tasksAPI');

    useAuth.mockReturnValue({ isAdminUser: true });
    getResolvedTaskFormSchema.mockResolvedValueOnce({
      name: 'CustomTask',
      taskType: TaskEntityType.CustomTask,
      taskCategory: TaskCategory.Custom,
      formSchema: {
        type: 'object',
        properties: {
          targetField: { type: 'string', title: 'Target Field' },
          proposedText: { type: 'string', title: 'Proposed Text' },
          reviewNotes: { type: 'string', title: 'Review Notes' },
        },
      },
      uiSchema: {
        'ui:handler': {
          type: 'descriptionUpdate',
          fieldPathField: 'targetField',
          valueField: 'proposedText',
        },
        'ui:resolution': {
          mode: 'payload',
        },
      },
    });

    await act(async () => {
      render(<TaskTabNew {...mockProps} task={MOCK_CUSTOM_TASK} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-accept-task-action-primary'));
    });

    await waitFor(() => {
      expect(resolveTask).toHaveBeenCalledWith(MOCK_CUSTOM_TASK.id, {
        resolutionType: 'Approved',
        newValue: undefined,
        payload: {
          targetField: 'description',
          proposedText: 'Custom description proposal',
          reviewNotes: 'Needs final verification',
        },
      });
    });
  });

  it('keeps workflow-driven tasks actionable outside the Open status', async () => {
    const { useAuth } = require('../../../../hooks/authHooks');
    const {
      getResolvedTaskFormSchema,
    } = require('../../../../utils/TaskFormSchemaUtils');

    useAuth.mockReturnValue({ isAdminUser: true });
    getResolvedTaskFormSchema.mockResolvedValueOnce({
      name: 'CustomTask',
      taskType: TaskEntityType.CustomTask,
      taskCategory: TaskCategory.Custom,
      formSchema: {
        type: 'object',
        properties: {},
      },
      uiSchema: {
        'ui:handler': {
          type: 'custom',
        },
      },
    });

    await act(async () => {
      render(<TaskTabNew {...mockProps} task={MOCK_WORKFLOW_TASK} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      screen.getByTestId('workflow-task-action-primary')
    ).toBeInTheDocument();
    expect(screen.getByTestId('comments-input-field')).toBeInTheDocument();
  });

  it('resolves workflow-driven tasks using transition ids', async () => {
    const { useAuth } = require('../../../../hooks/authHooks');
    const {
      getResolvedTaskFormSchema,
    } = require('../../../../utils/TaskFormSchemaUtils');
    const { resolveTask } = require('../../../../rest/tasksAPI');

    useAuth.mockReturnValue({ isAdminUser: true });
    getResolvedTaskFormSchema.mockResolvedValueOnce({
      name: 'CustomTask',
      taskType: TaskEntityType.CustomTask,
      taskCategory: TaskCategory.Custom,
      formSchema: {
        type: 'object',
        properties: {},
      },
      uiSchema: {
        'ui:handler': {
          type: 'custom',
        },
        'ui:resolution': {
          mode: 'payload',
        },
      },
    });

    await act(async () => {
      render(<TaskTabNew {...mockProps} task={MOCK_WORKFLOW_TASK} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('workflow-task-action-primary'));
    });

    await waitFor(() => {
      expect(resolveTask).toHaveBeenCalledWith(MOCK_WORKFLOW_TASK.id, {
        transitionId: 'startProgress',
        resolutionType: 'Approved',
        comment: undefined,
        newValue: undefined,
        payload: {
          targetField: 'description',
          proposedText: 'Custom description proposal',
          reviewNotes: 'Needs final verification',
        },
      });
    });
  });
});
