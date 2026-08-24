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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { TaskEntityType } from '../../rest/tasksAPI';
import NotificationFeedCard from './NotificationFeedCard.component';
import { MentionNotification } from './NotificationFeedCard.interface';

jest.mock('../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockImplementation((date) => date),
  getRelativeTime: jest.fn().mockImplementation((date) => date),
  getEpochMillisForPastDays: jest.fn().mockImplementation((days) => days),
  getStartOfDayInMillis: jest.fn().mockImplementation((val) => val),
  getEndOfDayInMillis: jest.fn().mockImplementation((val) => val),
  getCurrentMillis: jest.fn().mockReturnValue(0),
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
  jest.fn().mockReturnValue(<p data-testid="profile-picture">ProfilePicture</p>)
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
  getEntityName: jest
    .fn()
    .mockImplementation(({ displayName, name }) => displayName || name || ''),
}));

const mockMentionThread = {
  id: '33873393-bd68-46e9-bccc-7701c1c41ad6',
  type: 'Conversation',
  threadTs: 1755772414483,
  about: '<#E::page::Article_sQDEeTK6::description>',
  entityRef: {
    id: 'eda48fe4-515f-44ee-8afc-f7e4ef01277a',
    type: 'page',
    name: 'Article_sQDEeTK6',
    fullyQualifiedName: 'Article_sQDEeTK6',
    description: '',
    displayName: 'SACHIN',
  },
  createdBy: 'admin',
  updatedAt: 1755772414483,
  updatedBy: 'admin',
  message:
    '﻿<#E::user::admin|[@admin](http://localhost:3000/users/admin)>﻿ Hii!',
  postsCount: 0,
  posts: [],
  reactions: [],
} as MentionNotification;

// A chat-collaborator notification: `about` is the invitee's own user record,
// so the conversation is carried in entityUrlLink / feedInfo instead.
const mockChatCollaboratorThread = {
  id: '5881af12-0f94-49b9-b686-268203b01de0',
  threadTs: 1755772414483,
  about: '<#E::user::shreyansh>',
  entityRef: {
    id: 'eda48fe4-515f-44ee-8afc-f7e4ef01277a',
    type: 'user',
    name: 'shreyansh',
    displayName: 'Shreyansh Verma',
  },
  entityUrlLink: '/conversations/abc-123',
  feedInfo: { headerMessage: 'Chat Initialization' },
  createdBy: 'vishnu.jain',
  message: '<#E::user::shreyansh> can now view and reply in this conversation.',
  postsCount: 0,
  posts: [],
  reactions: [],
} as MentionNotification;

const mockTaskEntity = {
  id: 'task-id',
  taskId: 'TASK-00001',
  type: TaskEntityType.GlossaryApproval,
  about: {
    type: 'glossaryTerm',
    fullyQualifiedName: 'testGlossary.testTerm',
  },
};

const taskProps = {
  createdBy: 'admin',
  entityType: 'glossaryTerm',
  entityFQN: 'testGlossary.testTerm',
  taskEntity: mockTaskEntity,
};

describe('NotificationFeedCard', () => {
  it('renders task notifications from task entities', async () => {
    mockGetTaskDetailPathFromTask.mockReturnValue('/mock-task-link');

    await act(async () => {
      render(<NotificationFeedCard {...taskProps} />);
    });

    expect(await screen.findByText('ProfilePicture')).toBeInTheDocument();
    expect(
      screen.getByText(/assigned-you-a-new-task-lowercase/i)
    ).toBeInTheDocument();
    expect(screen.getByText('#1 Glossary Approval')).toBeInTheDocument();
    expect(mockGetTaskDetailPathFromTask).toHaveBeenCalledWith(mockTaskEntity);
    expect(screen.getAllByTestId('link')[0]).toHaveAttribute(
      'data-to',
      '/mock-task-link'
    );
  });

  it('renders mention notifications from threads', async () => {
    mockPrepareFeedLink.mockReturnValue('/entity/activity_feed/all');

    await act(async () => {
      render(
        <NotificationFeedCard
          createdBy="admin"
          entityFQN="Article_sQDEeTK6"
          entityType="page"
          mentionNotification={mockMentionThread}
          timestamp={mockMentionThread.threadTs}
        />
      );
    });

    expect(
      screen.getByText(/mentioned-you-on-the-lowercase/i)
    ).toBeInTheDocument();
    expect(screen.getByText('page')).toBeInTheDocument();
    expect(screen.getByText('SACHIN')).toBeInTheDocument();
    expect(mockPrepareFeedLink).toHaveBeenCalledWith(
      'page',
      'Article_sQDEeTK6',
      'all'
    );
  });

  it('links a chat-collaborator notification to the conversation, not the invitee profile', async () => {
    mockPrepareFeedLink.mockReturnValue('/entity/activity_feed/all');

    await act(async () => {
      render(
        <NotificationFeedCard
          createdBy="vishnu.jain"
          entityFQN="shreyansh"
          entityType="user"
          mentionNotification={mockChatCollaboratorThread}
          timestamp={mockChatCollaboratorThread.threadTs}
        />
      );
    });

    expect(
      screen.getByText(/added-you-as-a-collaborator-on-lowercase/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Chat Initialization')).toBeInTheDocument();
    // The generic "mentioned you on the <entityType>" wording would have read
    // "on the user" and sent the reader to their own profile.
    expect(screen.queryByText(/mentioned-you-on-the-lowercase/i)).toBeNull();
    expect(screen.queryByText('user')).toBeNull();

    screen.getAllByTestId('link').forEach((link) => {
      expect(link).toHaveAttribute('data-to', '/conversations/abc-123');
    });
  });

  it.each([
    ['feedInfo is absent', undefined],
    // An empty title must fall back too, or the link renders with no label.
    ['headerMessage is empty', { headerMessage: '' }],
  ])(
    'falls back to a generic conversation label when %s',
    async (_label, feedInfo) => {
      await act(async () => {
        render(
          <NotificationFeedCard
            createdBy="vishnu.jain"
            entityFQN="shreyansh"
            entityType="user"
            mentionNotification={{
              ...mockChatCollaboratorThread,
              feedInfo,
            }}
            timestamp={mockChatCollaboratorThread.threadTs}
          />
        );
      });

      expect(screen.getByText('label.conversation')).toBeInTheDocument();
    }
  );

  it('calls navigate with tasksRefreshKey state when the task notification card is clicked', async () => {
    mockGetTaskDetailPathFromTask.mockReturnValue('/mock-task-link');

    await act(async () => {
      render(<NotificationFeedCard {...taskProps} />);
    });

    const outerLink = screen.getAllByTestId('link')[0];
    fireEvent.click(outerLink);

    expect(mockNavigate).toHaveBeenCalledWith('/mock-task-link', {
      state: { tasksRefreshKey: expect.any(Number) },
    });
  });

  it('calls navigate with tasksRefreshKey state when the inner task ID link is clicked', async () => {
    mockGetTaskDetailPathFromTask.mockReturnValue('/mock-task-link');

    await act(async () => {
      render(<NotificationFeedCard {...taskProps} />);
    });

    const links = screen.getAllByTestId('link');
    const innerTaskLink = links[links.length - 1];
    fireEvent.click(innerTaskLink);

    expect(mockNavigate).toHaveBeenCalledWith('/mock-task-link', {
      state: { tasksRefreshKey: expect.any(Number) },
    });
  });

  it('does not call navigate when a mention notification is clicked', async () => {
    mockPrepareFeedLink.mockReturnValue('/entity/activity_feed/all');

    await act(async () => {
      render(
        <NotificationFeedCard
          createdBy="admin"
          entityFQN="Article_sQDEeTK6"
          entityType="page"
          mentionNotification={mockMentionThread}
          timestamp={mockMentionThread.threadTs}
        />
      );
    });

    const outerLink = screen.getAllByTestId('link')[0];
    fireEvent.click(outerLink);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('falls back to entity display name when mention thread has no entityRef', async () => {
    mockPrepareFeedLink.mockReturnValue('/entity/activity_feed/all');

    await act(async () => {
      render(
        <NotificationFeedCard
          createdBy="admin"
          entityFQN="Article_sQDEeTK6"
          entityType="page"
          mentionNotification={
            {
              ...mockMentionThread,
              entityRef: undefined,
            } as MentionNotification
          }
          timestamp={1692612000000}
        />
      );
    });

    expect(screen.getByText('database.schema.table')).toBeInTheDocument();
    expect(screen.getByText('1692612000000')).toBeInTheDocument();
  });
});
