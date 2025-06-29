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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import { useAuth } from '../../../../hooks/authHooks';
import {
  MOCK_TASK,
  MOCK_TASK_2,
  MOCK_TASK_3,
  TASK_COLUMNS,
  TASK_FEED,
} from '../../../../mocks/Task.mock';
import { mockUserData } from '../../../Settings/Users/mocks/User.mocks';
import { TaskTab } from './TaskTab.component';
import { TaskTabProps } from './TaskTab.interface';

jest.mock('../../../../rest/feedsAPI', () => ({
  updateTask: jest.fn().mockImplementation(() => Promise.resolve()),
  updateThread: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../ActivityFeed/ActivityFeedCardV2/ActivityFeedCardV2', () => {
  return jest.fn().mockImplementation(() => <p>ActivityFeedCardV2</p>);
});

jest.mock('../../../ActivityFeed/ActivityFeedEditor/ActivityFeedEditor', () => {
  return jest.fn().mockImplementation(({ editAction }) => (
    <div>
      <p>ActivityFeedEditor</p>
      {editAction}
    </div>
  ));
});

jest.mock('../../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => <p>OwnerLabel</p>),
}));

jest.mock('../../../common/InlineEdit/InlineEdit.component', () => {
  return jest.fn().mockImplementation(() => <p>InlineEdit</p>);
});

jest.mock('../../../../pages/TasksPage/shared/Assignees', () => {
  return jest.fn().mockImplementation(() => <p>Assignees</p>);
});

jest.mock('../../../../pages/TasksPage/shared/DescriptionTask', () => {
  return jest.fn().mockImplementation(() => <p>DescriptionTask</p>);
});

jest.mock('../../../../pages/TasksPage/shared/TagsTask', () => {
  return jest.fn().mockImplementation(() => <p>TagsTask</p>);
});

jest.mock('../../../common/PopOverCard/EntityPopOverCard', () => {
  return jest.fn().mockImplementation(() => <p>EntityPopOverCard</p>);
});

jest.mock(
  '../TaskTabIncidentManagerHeader/TaskTabIncidentManagerHeader.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <p>TaskTabIncidentManagerHeader</p>);
  }
);

jest.mock('../../../common/RichTextEditor/RichTextEditor', () => {
  return jest.fn().mockImplementation(() => <p>RichTextEditor</p>);
});

jest.mock('../../../../utils/CommonUtils', () => ({
  getNameFromFQN: jest.fn().mockReturnValue('getNameFromFQN'),
}));

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('getEntityName'),
}));

jest.mock('../../../../utils/FeedUtils', () => ({
  getEntityFQN: jest.fn().mockReturnValue('getEntityFQN'),
}));

jest.mock('../../../../utils/TasksUtils', () => ({
  ...jest.requireActual('../../../../utils/TasksUtils'),
  fetchOptions: jest.fn().mockReturnValue('getEntityLink'),
  getTaskDetailPath: jest.fn().mockReturnValue('/'),
  isDescriptionTask: jest.fn().mockReturnValue(false),
  isTagsTask: jest.fn().mockReturnValue(true),
  generateOptions: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock('../../../../rest/feedsAPI', () => ({
  updateTask: jest.fn(),
  updateThread: jest.fn(),
}));

jest.mock(
  '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn().mockImplementation(() => ({
      postFeed: jest.fn(),
      setActiveThread: jest.fn(),
    })),
    __esModule: true,
    default: 'ActivityFeedProvider',
  })
);

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: false }),
}));

const mockOnAfterClose = jest.fn();
const mockOnUpdateEntityDetails = jest.fn();

const mockProps: TaskTabProps = {
  taskThread: TASK_FEED,
  entityType: EntityType.TABLE,
  isForFeedTab: true,
  columns: TASK_COLUMNS,
  onAfterClose: mockOnAfterClose,
  onUpdateEntityDetails: mockOnUpdateEntityDetails,
};

describe('Test TaskFeedCard component', () => {
  it('Should render the component', async () => {
    render(<TaskTab {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const activityFeedCard = screen.getByTestId('task-tab');

    expect(activityFeedCard).toBeInTheDocument();
  });

  it('Should render the assignee and creator of task', async () => {
    render(<TaskTab {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByText('label.assignee-plural:')).toBeInTheDocument();
    expect(screen.getByText('label.created-by:')).toBeInTheDocument();
    expect(screen.getAllByText('OwnerLabel')).toHaveLength(2);
  });

  it('should not render task action button to the task owner if task has reviewer', async () => {
    render(<TaskTab {...mockProps} hasGlossaryReviewer />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('task-cta-buttons')).toHaveTextContent(
      'label.comment'
    );
    expect(screen.getByTestId('task-cta-buttons')).not.toHaveTextContent(
      'label.accept-suggestion'
    );
    expect(screen.getByTestId('task-cta-buttons')).not.toHaveTextContent(
      'label.add-entity'
    );
    expect(screen.getByTestId('task-cta-buttons')).not.toHaveTextContent(
      'label.add-suggestion'
    );
  });

  it('should render close button if the user is creator task', async () => {
    render(
      <TaskTab
        {...mockProps}
        taskThread={{
          ...TASK_FEED,
          createdBy: 'xyz',
        }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(screen.getByText('label.close')).toBeInTheDocument();
  });

  it('should not render close button if the user is not a creator of task', async () => {
    render(<TaskTab {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.queryByText('label.close')).not.toBeInTheDocument();
  });

  it('should not render close button if the user is a creator and even have hasEditAccess of task', async () => {
    (useAuth as jest.Mock).mockImplementation(() => ({
      isAdminUser: true,
    }));

    render(
      <TaskTab
        {...mockProps}
        taskThread={{ ...TASK_FEED, createdBy: 'xyz' }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(screen.queryByText('label.close')).not.toBeInTheDocument();
  });

  it('should not render close button if the user is a creator and assignee of task', async () => {
    render(
      <TaskTab
        {...mockProps}
        taskThread={{ ...TASK_FEED, createdBy: 'xyz', task: MOCK_TASK }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(screen.queryByText('label.close')).not.toBeInTheDocument();
  });

  it('should render dropdown button with add and close tag if task created with no tags', async () => {
    render(
      <TaskTab
        {...mockProps}
        taskThread={{ ...TASK_FEED, createdBy: 'xyz', task: MOCK_TASK_2 }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(screen.getByTestId('add-close-task-dropdown')).toBeInTheDocument();
    expect(screen.getByText('label.add-entity')).toBeInTheDocument();
    expect(screen.getByText('label.comment')).toBeInTheDocument();
  });

  it('should render dropdown button with resolve and reject tag if task is Glossary approval', async () => {
    render(
      <TaskTab
        {...mockProps}
        taskThread={{ ...TASK_FEED, task: MOCK_TASK_3 }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(
      screen.getByTestId('glossary-accept-reject-task-dropdown')
    ).toBeInTheDocument();
    expect(screen.getByText('label.approve')).toBeInTheDocument();
    expect(screen.getByText('label.comment')).toBeInTheDocument();
  });
});
