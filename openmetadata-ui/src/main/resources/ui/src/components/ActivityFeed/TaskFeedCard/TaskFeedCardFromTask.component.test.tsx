/*
 *  Copyright 2026 Collate.
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
/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  Task,
  TaskCategory,
  TaskEntityStatus,
  TaskEntityType,
  TaskPriority,
} from '../../../rest/tasksAPI';
import EntityLink from '../../../utils/EntityLink';
import TaskFeedCardFromTask from './TaskFeedCardFromTask.component';

const MOCK_TASK: Task = {
  id: 'task-id-1',
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
    id: 'user-id-1',
    type: 'user',
    name: 'admin',
    displayName: 'Admin User',
  },
  assignees: [
    {
      id: 'team-id-1',
      type: 'team',
      name: 'DataGovernance',
      fullyQualifiedName: 'DataGovernance',
    },
  ],
  payload: {
    field: 'tags',
    fieldPath: 'columns::shop_id::tags',
    currentValue: '[]',
    suggestedValue:
      '[{"tagFQN":"PersonalData.SpecialCategory","source":"Classification","name":"SpecialCategory"}]',
  },
  comments: [],
  commentCount: 0,
  createdAt: 1701686127533,
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: jest.fn().mockImplementation(() => ({
    setActiveTask: jest.fn(),
    showTaskDrawer: jest.fn(),
  })),
}));

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => ({
    isAdminUser: false,
  })),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: {
      id: 'current-user-id',
      name: 'current-user',
      teams: [],
    },
  })),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: jest.fn().mockImplementation(() => [
    undefined,
    undefined,
    {
      id: 'user-id-1',
      name: 'admin',
      displayName: 'Admin User',
    },
  ]),
}));

jest.mock('../../../pages/TasksPage/shared/TagsTaskFromTask', () => {
  return jest.fn().mockImplementation(() => <p>TagsTaskFromTask</p>);
});

jest.mock('../../../pages/TasksPage/shared/DescriptionTaskFromTask', () => {
  return jest.fn().mockImplementation(() => <p>DescriptionTaskFromTask</p>);
});

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockReturnValue(<p>OwnerLabel</p>),
}));

jest.mock('../../../components/common/PopOverCard/EntityPopOverCard', () => {
  return jest.fn().mockImplementation(({ children }) => children);
});

jest.mock('../../../components/common/PopOverCard/UserPopOverCard', () => {
  return jest.fn().mockImplementation(({ children }) => children);
});

jest.mock('../../../rest/tasksAPI', () => ({
  ...jest.requireActual('../../../rest/tasksAPI'),
  resolveTask: jest.fn().mockResolvedValue({}),
  closeTask: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getNameFromFQN: jest.fn().mockReturnValue('entityName'),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Admin User'),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockReturnValue('2023-12-04 10:15:27'),
  getRelativeTime: jest.fn().mockReturnValue('2 hours ago'),
  getEpochMillisForPastDays: jest.fn().mockReturnValue(1234567890),
  getCurrentMillis: jest.fn().mockReturnValue(1234567890),
  getStartOfDayInMillis: jest.fn().mockReturnValue(1234567890),
  getEndOfDayInMillis: jest.fn().mockReturnValue(1234567890),
}));

jest.mock('../../../utils/EntityLink', () => ({
  __esModule: true,
  default: {
    getTableColumnName: jest.fn().mockReturnValue('shop_id'),
  },
}));

jest.mock('../../../utils/TasksUtils', () => ({
  ...jest.requireActual('../../../utils/TasksUtils'),
  getTaskDetailPathFromTask: jest.fn().mockReturnValue('/tasks/1'),
  isTagsTaskType: jest.fn().mockReturnValue(true),
  isDescriptionTaskType: jest.fn().mockReturnValue(false),
  isRecognizerFeedbackTask: jest.fn().mockReturnValue(false),
}));

describe('TaskFeedCardFromTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (EntityLink.getTableColumnName as jest.Mock).mockReturnValue('shop_id');
  });

  it('should display the numeric task id like main UI', async () => {
    await act(async () => {
      render(<TaskFeedCardFromTask task={MOCK_TASK} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('redirect-task-button-link')).toHaveTextContent(
      '#2'
    );
    expect(
      screen.getByTestId('redirect-task-button-link')
    ).not.toHaveTextContent('#TASK-00002');
  });

  it('should use the normalized field path to render the column label', async () => {
    await act(async () => {
      render(<TaskFeedCardFromTask task={MOCK_TASK} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(EntityLink.getTableColumnName).toHaveBeenCalledWith(
      '<#E::table::sample_data.ecommerce_db.shopify."dim.shop"::columns::shop_id::tags>'
    );
  });
});
