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
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TASK_FEED, TASK_POST } from '../../../mocks/Task.mock';
import TaskFeedCard from './TaskFeedCard.component';

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
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

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockReturnValue(<p>OwnerLabel</p>),
}));

jest.mock('../../../components/common/PopOverCard/EntityPopOverCard', () => {
  return jest.fn().mockImplementation(({ children }) => children);
});

jest.mock('../../../components/common/PopOverCard/UserPopOverCard', () => {
  return jest.fn().mockImplementation(() => <p>UserPopOverCard</p>);
});

jest.mock('../../../components/common/ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockImplementation(() => <p>ProfilePicture</p>);
});

jest.mock('../Shared/ActivityFeedActions', () => {
  return jest.fn().mockImplementation(() => <p>ActivityFeedActions</p>);
});

jest.mock('../../../utils/TasksUtils', () => ({
  getTaskDetailPath: jest.fn().mockReturnValue('/'),
}));

jest.mock('../../../utils/FeedUtils', () => ({
  getEntityFQN: jest.fn().mockReturnValue('entityFQN'),
  getEntityType: jest.fn().mockReturnValue('entityType'),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockReturnValue('formatDateTime'),
  getRelativeTime: jest.fn().mockReturnValue('getRelativeTime'),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getNameFromFQN: jest.fn().mockReturnValue('formatDateTime'),
}));

jest.mock('../../../utils/EntityLink', () => {
  return {
    __esModule: true,
    default: {
      getTableColumnName: jest.fn().mockReturnValue('getTableColumnName'),
    },
  };
});

const mockProps = {
  post: TASK_POST,
  feed: TASK_FEED,
  showThread: false,
  isActive: true,
  hidePopover: true,
  isForFeedTab: true,
};

describe('Test TaskFeedCard Component', () => {
  it('Should render TaskFeedCard component', async () => {
    await act(async () => {
      render(<TaskFeedCard {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('task-feed-card')).toBeInTheDocument();
    expect(screen.getByTestId('task-status-icon-open')).toBeInTheDocument();
    expect(screen.getByTestId('redirect-task-button-link')).toBeInTheDocument();
  });

  it('Should render OwnerLabel when show thread is true', async () => {
    await act(async () => {
      render(<TaskFeedCard {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('label.assignee-plural:')).toBeInTheDocument();
    expect(screen.getByText('OwnerLabel')).toBeInTheDocument();
  });
});
