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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import {
  Conversation,
  ConversationSource,
} from '../../generated/entity/feed/conversation';
import { Task, TaskEntityType } from '../../rest/tasksAPI';
import NotificationFeedCard from './NotificationFeedCard.component';

jest.mock('../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn((date) => date),
  getRelativeTime: jest.fn((date) => date),
}));

const mockPrepareFeedLink = jest.fn();
const mockGetTaskDetailPathFromTask = jest.fn();

jest.mock('../../utils/FeedUtilsPure', () => ({
  entityDisplayName: jest.fn().mockReturnValue('database.schema.table'),
  prepareFeedLink: (...args: unknown[]) => mockPrepareFeedLink(...args),
}));

jest.mock('../../utils/TaskNavigationUtils', () => ({
  getTaskDetailPathFromTask: (...args: unknown[]) =>
    mockGetTaskDetailPathFromTask(...args),
  getTaskDisplayId: jest.fn().mockReturnValue('1'),
}));

jest.mock('../common/ProfilePicture/ProfilePicture', () =>
  jest.fn(() => <p data-testid="profile-picture">ProfilePicture</p>)
);

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(
      ({
        children,
        to,
        onClick,
      }: {
        children: React.ReactNode;
        to: string;
        onClick?: (e: React.MouseEvent) => void;
      }) => (
        <span
          data-testid="link"
          data-to={to}
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onClick?.(e as unknown as React.MouseEvent);
            }
          }}>
          {children}
        </span>
      )
    ),
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock('../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn(({ displayName, name }) => displayName || name || ''),
}));

const mockMentionConversation: Conversation = {
  id: '33873393-bd68-46e9-bccc-7701c1c41ad6',
  source: ConversationSource.User,
  createdAt: 1755772414483,
  updatedAt: 1755772414483,
  about: '<#E::knowledgePage::Article_sQDEeTK6::description>',
  entityRef: {
    id: 'eda48fe4-515f-44ee-8afc-f7e4ef01277a',
    type: 'knowledgePage',
    name: 'Article_sQDEeTK6',
    fullyQualifiedName: 'Article_sQDEeTK6',
    displayName: 'SACHIN',
  },
  createdBy: { id: 'admin-id', type: 'user', name: 'admin' },
  message: '<#E::user::admin> Hii!',
  replyCount: 0,
  replies: [],
  reactions: [],
  resolved: false,
};

const mockTaskEntity = {
  id: 'task-id',
  taskId: 'TASK-00001',
  type: TaskEntityType.GlossaryApproval,
  about: {
    type: 'glossaryTerm',
    fullyQualifiedName: 'testGlossary.testTerm',
  },
} as Task;

const taskProps = {
  createdBy: 'admin',
  entityType: 'glossaryTerm',
  entityFQN: 'testGlossary.testTerm',
  taskEntity: mockTaskEntity,
};

describe('NotificationFeedCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders task notifications from task entities', async () => {
    mockGetTaskDetailPathFromTask.mockReturnValue('/mock-task-link');

    await act(async () => render(<NotificationFeedCard {...taskProps} />));

    expect(await screen.findByText('ProfilePicture')).toBeInTheDocument();
    expect(
      screen.getByText(/assigned-you-a-new-task-lowercase/i)
    ).toBeInTheDocument();
    expect(screen.getByText('#1 Glossary Approval')).toBeInTheDocument();
    expect(mockGetTaskDetailPathFromTask).toHaveBeenCalledWith(mockTaskEntity);
  });

  it('renders Conversation V2 mention notifications', async () => {
    mockPrepareFeedLink.mockReturnValue('/entity/activity_feed/all');

    await act(async () =>
      render(
        <NotificationFeedCard
          createdBy="admin"
          entityFQN="Article_sQDEeTK6"
          entityType="knowledgePage"
          mentionNotification={mockMentionConversation}
          timestamp={mockMentionConversation.createdAt}
        />
      )
    );

    expect(
      screen.getByText(/mentioned-you-on-the-lowercase/i)
    ).toBeInTheDocument();
    expect(screen.getByText('knowledgePage')).toBeInTheDocument();
    expect(screen.getByText('SACHIN')).toBeInTheDocument();
    expect(mockPrepareFeedLink).toHaveBeenCalledWith(
      'knowledgePage',
      'Article_sQDEeTK6',
      'all'
    );
  });

  it('refreshes the task page when a task notification is clicked', async () => {
    mockGetTaskDetailPathFromTask.mockReturnValue('/mock-task-link');
    await act(async () => render(<NotificationFeedCard {...taskProps} />));

    fireEvent.click(screen.getAllByTestId('link')[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/mock-task-link', {
      state: { tasksRefreshKey: expect.any(Number) },
    });
  });

  it('uses normal link navigation for a conversation mention', async () => {
    mockPrepareFeedLink.mockReturnValue('/entity/activity_feed/all');
    await act(async () =>
      render(
        <NotificationFeedCard
          createdBy="admin"
          entityFQN="Article_sQDEeTK6"
          entityType="knowledgePage"
          mentionNotification={mockMentionConversation}
          timestamp={mockMentionConversation.createdAt}
        />
      )
    );

    fireEvent.click(screen.getAllByTestId('link')[0]);

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
