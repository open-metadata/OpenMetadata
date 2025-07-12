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
import {
  TaskType,
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../../../generated/entity/feed/thread';
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

const mockEntityThread: Thread[] = [
  {
    id: '1',
    message: 'Task 1',
    about: 'test.task1',
    task: {
      status: ThreadTaskStatus.Open,
      id: 1,
      type: TaskType.RequestDescription,
      assignees: [],
    },
    type: ThreadType.Task,
    updatedAt: 1640995200000,
  },
  {
    id: '2',
    message: 'Task 2',
    about: 'test.task2',
    task: {
      status: ThreadTaskStatus.Open,
      id: 2,
      type: TaskType.RequestDescription,
      assignees: [],
    },
    type: ThreadType.Task,
    updatedAt: 1641081600000,
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
      getFeedData: jest.fn(),
      entityThread: mockEntityThread,
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
      getFeedData: jest.fn(),
      entityThread: [],
    });

    renderMyTaskWidget();

    expect(screen.getByTestId('my-task-empty-state')).toBeInTheDocument();
    expect(screen.getByText('label.no-tasks-yet')).toBeInTheDocument();
  });

  it('renders footer when tasks are available', () => {
    renderMyTaskWidget();

    expect(screen.getByTestId('widget-footer')).toBeInTheDocument();
    expect(screen.getByText('label.view-more')).toBeInTheDocument();
  });

  it('renders widget wrapper', () => {
    renderMyTaskWidget();

    expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();
  });

  it('calls getFeedData on mount with correct parameters', () => {
    const mockGetFeedData = jest.fn();
    (mockUseActivityFeedProvider as jest.Mock).mockReturnValue({
      loading: false,
      getFeedData: mockGetFeedData,
      entityThread: mockEntityThread,
    });
    renderMyTaskWidget();

    expect(mockGetFeedData).toHaveBeenCalledWith(
      'OWNER',
      undefined,
      'Task',
      undefined,
      undefined,
      'Open'
    );
  });
});
