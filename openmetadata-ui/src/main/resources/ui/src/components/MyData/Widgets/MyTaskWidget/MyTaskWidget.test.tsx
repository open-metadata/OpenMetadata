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

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useFqn } from '../../../../hooks/useFqn';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import MyTaskWidget from './MyTaskWidget';

// Mock the hooks
jest.mock('../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider');
jest.mock('../../../../hooks/useApplicationStore');
jest.mock('../../../../hooks/useFqn');

const mockUseActivityFeedProvider =
  useActivityFeedProvider as jest.MockedFunction<
    typeof useActivityFeedProvider
  >;
const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
>;
const mockUseFqn = useFqn as jest.MockedFunction<typeof useFqn>;

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

const mockActivityFeedData = {
  loading: false,
  entityThread: [
    {
      id: '1',
      message: 'Task 1',
      task: { status: 'Open' },
      type: 'table',
      fullyQualifiedName: 'test.task1',
      updatedAt: '2023-01-01T00:00:00Z',
    },
    {
      id: '2',
      message: 'Task 2',
      task: { status: 'Open' },
      type: 'table',
      fullyQualifiedName: 'test.task2',
      updatedAt: '2023-01-02T00:00:00Z',
    },
  ],
  entityPaging: { after: null },
  getFeedData: jest.fn(),
};

const mockApplicationStore = {
  currentUser: {
    name: 'test-user',
    isAdmin: false,
  },
};

const mockFqn = 'test-fqn';

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

    mockUseActivityFeedProvider.mockReturnValue(mockActivityFeedData);
    mockUseApplicationStore.mockReturnValue(mockApplicationStore);
    mockUseFqn.mockReturnValue({ fqn: mockFqn });
  });

  it('renders widget with header', () => {
    renderMyTaskWidget();

    expect(screen.getByText('label.my-task-plural')).toBeInTheDocument();
    expect(screen.getByTestId('task-icon')).toBeInTheDocument();
  });

  it('renders sort options in header', () => {
    renderMyTaskWidget();

    expect(screen.getByTestId('sort-by-button')).toBeInTheDocument();
    expect(screen.getByText('Latest')).toBeInTheDocument();
  });

  it('handles sort option changes', () => {
    renderMyTaskWidget();

    const sortButton = screen.getByTestId('sort-by-button');
    fireEvent.click(sortButton);

    const aToZOption = screen.getByText('A to Z');
    fireEvent.click(aToZOption);

    expect(screen.getByText('A to Z')).toBeInTheDocument();
  });

  it('renders task list when data is available', () => {
    renderMyTaskWidget();

    expect(screen.getByTestId('My Task-Task 1')).toBeInTheDocument();
    expect(screen.getByTestId('My Task-Task 2')).toBeInTheDocument();
  });

  it('renders empty state when no tasks', () => {
    mockUseActivityFeedProvider.mockReturnValue({
      ...mockActivityFeedData,
      entityThread: [],
    });

    renderMyTaskWidget();

    expect(screen.getByTestId('my-task-empty-state')).toBeInTheDocument();
    expect(screen.getByText('label.no-tasks-yet')).toBeInTheDocument();
  });

  it('renders footer with view more button when pagination available', () => {
    mockUseActivityFeedProvider.mockReturnValue({
      ...mockActivityFeedData,
      entityPaging: { after: 'next-page' },
    });

    renderMyTaskWidget();

    expect(screen.getByTestId('my-task-footer')).toBeInTheDocument();
    expect(screen.getByText('label.view-more')).toBeInTheDocument();
  });

  it('does not render footer when no pagination', () => {
    renderMyTaskWidget();

    expect(screen.queryByTestId('my-task-footer')).not.toBeInTheDocument();
  });

  it('renders widget wrapper with correct props', () => {
    renderMyTaskWidget();

    expect(screen.getByTestId('my-task-widget-wrapper')).toBeInTheDocument();
  });

  it('handles edit view correctly', () => {
    renderMyTaskWidget({ isEditView: true });

    expect(screen.getByTestId('my-task-widget-wrapper')).toBeInTheDocument();
    // More options should be rendered by wrapper in edit view
    expect(screen.getByTestId('widget-more-options')).toBeInTheDocument();
  });

  it('calls getFeedData on mount', () => {
    renderMyTaskWidget();

    expect(mockActivityFeedData.getFeedData).toHaveBeenCalledWith(
      'owner-or-follows',
      undefined,
      'Task',
      undefined,
      'test-fqn',
      'Open'
    );
  });

  it('handles task item clicks', () => {
    renderMyTaskWidget();

    const taskLink = screen.getByTestId('My Task-Task 1');

    expect(taskLink).toBeInTheDocument();
  });

  it('renders task descriptions when available', () => {
    mockUseActivityFeedProvider.mockReturnValue({
      ...mockActivityFeedData,
      entityThread: [
        {
          id: '1',
          message: 'Task 1',
          description: 'Task description',
          task: { status: 'Open' },
          type: 'table',
          fullyQualifiedName: 'test.task1',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ],
    });

    renderMyTaskWidget();

    expect(screen.getByText('Task description')).toBeInTheDocument();
  });

  it('handles widget width changes', () => {
    renderMyTaskWidget({
      currentLayout: [
        {
          i: 'my-task-widget',
          x: 0,
          y: 0,
          w: 1,
          h: 4,
          config: {},
        },
      ],
    });

    expect(screen.getByTestId('my-task-widget-wrapper')).toBeInTheDocument();
  });

  it('handles loading state', () => {
    mockUseActivityFeedProvider.mockReturnValue({
      ...mockActivityFeedData,
      loading: true,
    });

    renderMyTaskWidget();

    expect(screen.getByTestId('my-task-widget-wrapper')).toBeInTheDocument();
  });

  it('handles admin user correctly', () => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: {
        name: 'admin-user',
        isAdmin: true,
      },
    });

    renderMyTaskWidget();

    expect(mockActivityFeedData.getFeedData).toHaveBeenCalledWith(
      'all',
      undefined,
      'Task',
      undefined,
      'test-fqn',
      'Open'
    );
  });
});
