/*
 *  Copyright 2022 Collate.
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
import { Thread, ThreadType } from '../../../../generated/entity/feed/thread';
import FeedCardHeader from './FeedCardHeader';

const mockProps1 = {
  createdBy: 'username',
  entityFQN: 'service.database.schema.table',
  entityField: 'entityField',
  entityType: 'table',
  isEntityFeed: true,
  timeStamp: 1647322547179,
  feedType: ThreadType.Conversation,
  task: {} as Thread,
};

const mockProps2 = {
  ...mockProps1,
  isEntityFeed: false,
};

jest.mock('../../../../utils/RouterUtils', () => ({
  getUserPath: jest.fn().mockReturnValue('user-profile-path'),
}));

jest.mock('../../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockImplementation((date) => date),
  getRelativeTime: jest.fn().mockImplementation((date) => date),
}));

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('username'),
}));

jest.mock('../../../../utils/FeedUtils', () => ({
  entityDisplayName: jest.fn().mockReturnValue('database.schema.table'),
  getEntityFieldDisplay: jest
    .fn()
    .mockImplementation((entityField) => entityField),
  prepareFeedLink: jest.fn().mockReturnValue('entity-link'),
}));

jest.mock('../../../../utils/TasksUtils', () => ({
  getTaskDetailPath: jest.fn().mockReturnValue('task detail path'),
}));

jest.mock('../../../common/PopOverCard/EntityPopOverCard', () =>
  jest.fn().mockImplementation(({ children }) => (
    <>
      EntityPopOverCard
      <div>{children}</div>
    </>
  ))
);

jest.mock('../../../common/PopOverCard/UserPopOverCard', () =>
  jest.fn().mockImplementation(({ children }) => (
    <>
      UserPopOverCard
      <div>{children}</div>
    </>
  ))
);

describe('Test FeedHeader Component', () => {
  it('should contain all necessary elements, when isEntityFeed true', () => {
    render(<FeedCardHeader {...mockProps1} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByText('UserPopOverCard')).toBeInTheDocument();
    expect(screen.getByText('username')).toBeInTheDocument();

    expect(screen.getByTestId('headerText-entityField')).toBeInTheDocument();

    expect(screen.getByTestId('timestamp')).toBeInTheDocument();

    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('entitylink')).not.toBeInTheDocument();
  });

  it('should contain all necessary elements, when isEntityFeed false', () => {
    render(<FeedCardHeader {...mockProps2} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByText('UserPopOverCard')).toBeInTheDocument();
    expect(screen.getByText('username')).toBeInTheDocument();

    expect(screen.getByText('table')).toBeInTheDocument();
    expect(screen.getByText('database.schema.table')).toBeInTheDocument();
    expect(screen.getByTestId('entitylink')).toBeInTheDocument();

    expect(screen.getByTestId('timestamp')).toBeInTheDocument();

    expect(
      screen.queryByTestId('headerText-entityField')
    ).not.toBeInTheDocument();
  });
});
