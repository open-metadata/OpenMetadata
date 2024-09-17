/*
 *  Copyright 2024 Collate.
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
import { ThreadType } from '../../generated/api/feed/createThread';
import NotificationFeedCard from './NotificationFeedCard.component';

jest.mock('../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockImplementation((date) => date),
  getRelativeTime: jest.fn().mockImplementation((date) => date),
}));
jest.mock('../../utils/FeedUtils', () => ({
  entityDisplayName: jest.fn().mockReturnValue('database.schema.table'),
  prepareFeedLink: jest.fn().mockReturnValue('entity-link'),
}));
jest.mock('../../utils/TasksUtils', () => ({
  getTaskDetailPath: jest.fn().mockReturnValue('/'),
}));
jest.mock('../common/ProfilePicture/ProfilePicture', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="profile-picture">ProfilePicture</p>);
});
jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
}));
const mockThread = {
  about: 'test',
  id: '33873393-bd68-46e9-bccc-7701c1c41ad6',
  message: 'f93d08e9-2d38-4d01-a294-f8b44fbb0f4a',
};

const mockProps = {
  createdBy: 'admin',
  entityType: 'task',
  entityFQN: 'test',
  task: mockThread,
  feedType: ThreadType.Task,
};

describe('Test NotificationFeedCard Component', () => {
  it('Check if it has all child elements', async () => {
    await act(async () => {
      render(<NotificationFeedCard {...mockProps} />);
    });

    expect(await screen.findByText('ProfilePicture')).toBeInTheDocument();
  });
});
