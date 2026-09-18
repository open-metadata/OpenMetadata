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

import { render, screen } from '@testing-library/react';
import { ComponentProps, ReactNode } from 'react';

// Boundary stub: the real chip renders the OSS user popover.
jest.mock('components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../inbox.utils', () => ({
  formatInboxDateTime: (ts?: number) => `at-${ts}`,
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

// The comment bubble is covered by its own suite; here only its placement in
// the stream matters.
jest.mock('./TaskCommentRow', () => ({
  __esModule: true,
  default: ({ comment }: { comment: { message: string } }) => (
    <div data-testid="task-comment-card">{comment.message}</div>
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Box: ({
    children,
    ...rest
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={rest['data-testid']}>{children}</div>,
  Typography: ({
    children,
    ...rest
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <span data-testid={rest['data-testid']}>{children}</span>,
}));

jest.mock(
  '@untitledui/icons',
  () =>
    new Proxy(
      {},
      {
        get: (_target, name: string) =>
          name === '__esModule'
            ? false
            : (props: ComponentProps<'span'>) => <span {...props} />,
      }
    )
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Echo the interpolated user so a test can tell the events apart.
    t: (key: string, options?: { user?: string }) =>
      options?.user ? `${key}:${options.user}` : key,
  }),
}));

import { Task, TaskCategory } from '../../../../../generated/entity/tasks/task';
import TaskActivityTimeline from './TaskActivityTimeline';

const task = {
  id: 'task-1',
  comments: [
    {
      id: 'c1',
      author: { name: 'pb', displayName: 'Phoenix Baker' },
      createdAt: 30,
      message: 'hi',
    },
  ],
  assignees: [{ id: 'a1', name: 'as', displayName: 'Assignee One' }],
  createdBy: { id: 'u1', name: 'oy', displayName: 'Olivia Rhye' },
  createdAt: 10,
} as unknown as Task;

const renderTimeline = (value: Task) =>
  render(<TaskActivityTimeline task={value} onCommentChanged={jest.fn()} />);

describe('TaskActivityTimeline', () => {
  it('renders creation, assignment and comment entries in one stream', () => {
    renderTimeline(task);

    expect(
      screen.getByText('message.task-event-created:Olivia Rhye')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.task-event-assigned:Assignee One')
    ).toBeInTheDocument();
    expect(screen.getByTestId('task-comment-card')).toHaveTextContent('hi');
  });

  it('orders entries oldest first, so a comment follows the events it answers', () => {
    renderTimeline(task);

    const rendered = screen.getAllByTestId(
      /task-timeline-event|task-comment-card/
    );

    expect(rendered[0]).toHaveTextContent('message.task-event-created');
    expect(rendered[rendered.length - 1]).toHaveTextContent('hi');
  });

  it('renders only the creation event when there are no comments or assignees', () => {
    renderTimeline({
      id: 'task-2',
      createdBy: { name: 'x', displayName: 'X' },
      createdAt: 1,
    } as unknown as Task);

    expect(
      screen.getByText('message.task-event-created:X')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('task-comment-card')).not.toBeInTheDocument();
  });

  it('reads an incident as opened rather than created', () => {
    renderTimeline({
      id: 'task-3',
      category: TaskCategory.Incident,
      createdBy: { name: 'monitor', displayName: 'Collate monitor' },
      createdAt: 5,
    } as unknown as Task);

    expect(
      screen.getByText('message.task-event-incident-opened:Collate monitor')
    ).toBeInTheDocument();
  });
});
