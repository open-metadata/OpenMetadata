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
  '@openmetadata/ui-core-components/icons',
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

// Real {{param}} substitution, unlike the main suite's `.filter(Boolean)` mock
// which would silently drop an empty-string assignee and hide a dangling
// sentence. This is the test that catches the regression.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const strings: Record<string, string> = {
        'message.task-event-incident-assigned':
          '{{user}} assigned the incident to {{assignee}}',
        'message.task-event-incident-reassigned':
          '{{user}} reassigned the incident',
      };
      let out = strings[key] ?? key;
      if (options) {
        for (const k of Object.keys(options)) {
          out = out.replace(new RegExp(`{{${k}}}`, 'g'), options[k] ?? '');
        }
      }

      return out;
    },
  }),
}));

import { Task, TaskCategory } from '../../../../../generated/entity/tasks/task';
import { TestCaseResolutionStatus } from '../../../../../generated/tests/testCaseResolutionStatus';
import TaskActivityTimeline from './TaskActivityTimeline';

const task = {
  id: 'task-1',
  createdBy: { id: 'u1', name: 'jane', displayName: 'Jane' },
  createdAt: 10,
  assignees: [{ id: 'a1', name: 'as', displayName: 'Assignee One' }],
} as unknown as Task;

describe('TaskActivityTimeline — absent assignee', () => {
  // A real `Assigned` record written with no details, as happens when the sole
  // assignee has since been deleted. Must read "reassigned", not end on "to ".
  it('reads reassigned instead of a dangling "assigned to" when the record has no assignee', () => {
    render(
      <TaskActivityTimeline
        incidentStatuses={
          [
            {
              id: 's1',
              testCaseResolutionStatusType: 'Assigned',
              updatedBy: { id: 'u1', name: 'jane', displayName: 'Jane' },
              timestamp: 20,
            },
          ] as unknown as TestCaseResolutionStatus[]
        }
        task={{ ...task, category: TaskCategory.Incident } as Task}
        onCommentChanged={jest.fn()}
      />
    );

    const event = screen.getByTestId('task-timeline-event');

    expect(event.textContent).toBe('Jane reassigned the incident');
    expect(event.textContent).not.toMatch(/to $/);
  });

  // An Assigned record whose assignee object exists but carries no name (the
  // "stranger" case) must keep reading "reassigned" — no regression in the
  // branch the original guard already covered.
  it('still reads reassigned for an unnamed assignee object', () => {
    render(
      <TaskActivityTimeline
        incidentStatuses={
          [
            {
              id: 's2',
              testCaseResolutionStatusType: 'Assigned',
              updatedBy: { id: 'u1', name: 'jane', displayName: 'Jane' },
              testCaseResolutionStatusDetails: { assignee: { id: 'stranger' } },
              timestamp: 20,
            },
          ] as unknown as TestCaseResolutionStatus[]
        }
        task={{ ...task, category: TaskCategory.Incident } as Task}
        onCommentChanged={jest.fn()}
      />
    );

    const event = screen.getByTestId('task-timeline-event');

    expect(event.textContent).toBe('Jane reassigned the incident');
  });

  // A named assignee must still read "assigned the incident to <name>" — the
  // happy path is unchanged by the widened guard.
  it('still names the assignee when one is present', () => {
    render(
      <TaskActivityTimeline
        incidentStatuses={
          [
            {
              id: 's3',
              testCaseResolutionStatusType: 'Assigned',
              updatedBy: { id: 'u1', name: 'jane', displayName: 'Jane' },
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

    expect(screen.getByTestId('task-timeline-event')).toHaveTextContent(
      'Jane assigned the incident to Harsh'
    );
  });
});
