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
import { Thread } from '../../generated/entity/feed/thread';
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
jest.mock('../../utils/EntityUtils', () => ({
  getEntityLinkFromType: jest.fn().mockReturnValue('/mock-entity-link'),
  getEntityName: jest
    .fn()
    .mockImplementation(({ displayName, name }) => displayName || name || ''),
}));

jest.mock('../../utils/Fqn', () => ({
  split: jest.fn().mockReturnValue(['mockGlossary']),
}));
const mockThread = {
  id: '33873393-bd68-46e9-bccc-7701c1c41ad6',
  type: 'Conversation',
  href: 'http://host.docker.internal:8585/v1/feed/b41ef8d2-e369-4fce-b106-8f000258e361',
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
  generatedBy: 'user',
  cardStyle: 'default',
  fieldOperation: 'updated',
  createdBy: 'admin',
  updatedAt: 1755772414483,
  updatedBy: 'admin',
  resolved: false,
  task: {
    id: 16,
    type: 'RequestTestCaseFailureResolution',
    assignees: [
      {
        id: '9311f065-e150-4948-96a4-e98906443b37',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        displayName: 'admin',
        deleted: false,
      },
    ],
    status: 'Open',
    testCaseResolutionStatusId: '29c0871d-bd96-431b-8823-e968316915af',
  },
  message:
    '﻿<#E::user::admin|[@admin](http://localhost:3000/users/admin)>﻿ Hii!',
  postsCount: 0,
  posts: [],
  reactions: [],
};

const mockProps = {
  createdBy: 'admin',
  entityType: 'task',
  entityFQN: 'test',
  task: mockThread as Thread,
  feedType: ThreadType.Task,
};

describe('Test NotificationFeedCard Component', () => {
  it('Check if it has all child elements', async () => {
    await act(async () => {
      render(<NotificationFeedCard {...mockProps} />);
    });

    expect(await screen.findByText('ProfilePicture')).toBeInTheDocument();
  });

  it('renders assigned task message and link for ThreadType.Task', async () => {
    await act(async () => {
      render(<NotificationFeedCard {...mockProps} />);
    });

    expect(
      screen.getByText(/assigned-you-a-new-task-lowercase/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(`#${mockThread.task.id} ${mockThread.task.type}`)
    ).toBeInTheDocument();
  });

  it('renders mentioned message and entity link for ThreadType.Conversation', async () => {
    const conversationProps = {
      ...mockProps,
      feedType: ThreadType.Conversation,
    };
    await act(async () => {
      render(<NotificationFeedCard {...conversationProps} />);
    });

    expect(
      screen.getByText(/mentioned-you-on-the-lowercase/i)
    ).toBeInTheDocument();

    expect(screen.getByText(conversationProps.entityType)).toBeInTheDocument();
  });

  it('should renders entityRef data is available', async () => {
    const conversationProps = {
      ...mockProps,
      feedType: ThreadType.Conversation,
    };
    await act(async () => {
      render(<NotificationFeedCard {...conversationProps} />);
    });

    expect(
      screen.getByText(mockThread.entityRef.displayName)
    ).toBeInTheDocument();
  });

  it('should renders default entityName by entityDisplayName if entityRef not present', async () => {
    const conversationProps = {
      ...mockProps,
      task: {
        ...mockProps.task,
        entityRef: undefined,
      },
      feedType: ThreadType.Conversation,
    };
    await act(async () => {
      render(<NotificationFeedCard {...conversationProps} />);
    });

    expect(screen.getByText('database.schema.table')).toBeInTheDocument();
  });

  it('renders timestamp', async () => {
    const timestampProps = {
      ...mockProps,
      timestamp: 1692612000000, // Example: 2023-08-21T10:00:00Z in ms
    };
    await act(async () => {
      render(<NotificationFeedCard {...timestampProps} />);
    });

    expect(screen.getByText('1692612000000')).toBeInTheDocument();
  });
});
