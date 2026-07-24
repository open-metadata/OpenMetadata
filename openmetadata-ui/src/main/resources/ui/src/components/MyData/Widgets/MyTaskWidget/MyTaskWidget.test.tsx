/*
 *  Copyright 2025 Collate.
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
import { PAGE_SIZE_MEDIUM } from '../../../../constants/constants';
import { TaskEntityStatus, TaskEntityType } from '../../../../rest/tasksAPI';
import { useActivityFeedProvider as mockUseActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { mockUserData } from '../../../Settings/Users/mocks/User.mocks';
import MyTaskWidget from './MyTaskWidget';

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock('../../../ActivityFeed/ActivityFeedPanel/FeedPanelBodyV1New', () =>
  jest.fn().mockImplementation(() => <div>FeedPanelBodyV1New</div>)
);

jest.mock('../../../AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((Component) => Component),
}));

const mockProps = {
  isEditView: false,
  handleRemoveWidget: jest.fn(),
  widgetKey: 'my-task-widget',
  handleLayoutUpdate: jest.fn(),
  currentLayout: [
    {
      i: 'my-task-widget',
      x: 0,
      y: 0,
      w: 2,
      h: 4,
      config: {},
    },
  ],
};

const mockTasks = [
  {
    id: '1',
    taskId: 'TASK-00001',
    status: TaskEntityStatus.Open,
    type: TaskEntityType.DescriptionUpdate,
    assignees: [],
    about: {
      type: 'table',
      fullyQualifiedName: 'service.db.schema.task1',
      name: 'task1',
    },
    createdAt: 1640995200000,
  },
  {
    id: '2',
    taskId: 'TASK-00002',
    status: TaskEntityStatus.Open,
    type: TaskEntityType.DescriptionUpdate,
    assignees: [],
    about: {
      type: 'table',
      fullyQualifiedName: 'service.db.schema.task2',
      name: 'task2',
    },
    createdAt: 1641081600000,
  },
];

jest.mock(
  '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn(),
    __esModule: true,
    default: 'ActivityFeedProvider',
  })
);

const renderMyTaskWidget = (props = {}) => {
  return render(
    <MemoryRouter>
      <MyTaskWidget {...mockProps} {...props} />
    </MemoryRouter>
  );
};

describe('MyTaskWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockUseActivityFeedProvider as jest.Mock).mockReturnValue({
      loading: false,
      getTaskData: jest.fn(),
      tasks: mockTasks,
    });
  });

  it('renders widget with header', () => {
    renderMyTaskWidget();

    expect(screen.getByText('label.my-task-plural')).toBeInTheDocument();
    expect(screen.getByTestId('task-icon')).toBeInTheDocument();
  });

  it('renders empty state when no tasks', () => {
    (mockUseActivityFeedProvider as jest.Mock).mockReturnValue({
      loading: false,
      getTaskData: jest.fn(),
      tasks: [],
    });

    renderMyTaskWidget();

    expect(screen.getByTestId('my-task-empty-state')).toBeInTheDocument();
    expect(screen.getByText('label.no-tasks-yet')).toBeInTheDocument();
  });

  it('renders widget wrapper', () => {
    renderMyTaskWidget();

    expect(screen.getByTestId('KnowledgePanel.MyTask')).toBeInTheDocument();
  });

  it('calls getFeedData on mount with correct parameters', () => {
    const mockGetTaskData = jest.fn();
    (mockUseActivityFeedProvider as jest.Mock).mockReturnValue({
      loading: false,
      getTaskData: mockGetTaskData,
      tasks: mockTasks,
    });
    renderMyTaskWidget();

    expect(mockGetTaskData).toHaveBeenCalledWith(
      'OWNER_OR_FOLLOWS',
      undefined,
      undefined,
      undefined,
      undefined,
      PAGE_SIZE_MEDIUM
    );
  });
});
