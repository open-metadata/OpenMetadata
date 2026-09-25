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
    t: (key: string, options?: { user?: string; assignee?: string }) =>
      [key, options?.user, options?.assignee].filter(Boolean).join(':'),
  }),
}));

import { Task, TaskCategory } from '../../../../../generated/entity/tasks/task';
import { TestCaseResolutionStatus } from '../../../../../generated/tests/testCaseResolutionStatus';
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
  it('renders creation and comment entries in one stream', () => {
    renderTimeline(task);

    expect(
      screen.getByText('message.task-event-created:Olivia Rhye')
    ).toBeInTheDocument();
    expect(screen.getByTestId('task-comment-card')).toHaveTextContent('hi');
  });

  // The task records who holds it but never when they were given it: the event
  // shows, but without a time it would have to invent.
  it('shows the assignment without a timestamp', () => {
    renderTimeline(task);

    const assigned = screen
      .getByText('message.task-event-assigned:Assignee One')
      .closest('div');

    expect(assigned).not.toHaveTextContent(/at-\d+/);
    expect(
      screen.getByText('message.task-event-created:Olivia Rhye')
    ).toBeInTheDocument();
  });

  it('orders entries oldest first, so a comment follows the events it answers', () => {
    renderTimeline(task);

    const rendered = screen.getAllByTestId(
      /task-timeline-event|task-comment-card/
    );

    expect(rendered[0]).toHaveTextContent('message.task-event-created');
    expect(rendered[rendered.length - 1]).toHaveTextContent('hi');
  });

  it('renders only the creation event when there is nothing else to show', () => {
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

  it('names the assignee of an incident reassignment', () => {
    render(
      <TaskActivityTimeline
        incidentStatuses={
          [
            {
              id: 's1',
              testCaseResolutionStatusType: 'Assigned',
              updatedBy: { id: 't', name: 'teddy', displayName: 'Teddy' },
              testCaseResolutionStatusDetails: {
                assignee: { id: 'h', name: 'harsh', displayName: 'Harsh' },
              },
              timestamp: 20,
            },
          ] as unknown as TestCaseResolutionStatus[]
        }
        task={{ ...task, category: TaskCategory.Incident } as Task}
        onCommentChanged={jest.fn()}
      />
    );

    expect(
      screen.getByText('message.task-event-incident-assigned:Teddy:Harsh')
    ).toBeInTheDocument();
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
