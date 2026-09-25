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

import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';

// Boundary stub: the real chip renders the OSS user popover.
// Clamping and its tooltip have their own suite; render the text as is.
jest.mock('./ClampedText', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../taskTitle.utils', () => ({
  getTaskTitle: (task: {
    displayName?: string;
    name?: string;
    taskId?: string;
  }) => {
    const authored = task.displayName ?? task.name;

    return authored && authored !== task.taskId
      ? authored
      : 'Approval request for orders';
  },
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Box: ({
    children,
    className,
    onClick,
    onKeyDown,
  }: {
    children?: ReactNode;
    className?: string;
    onClick?: (...args: unknown[]) => void;
    onKeyDown?: (...args: unknown[]) => void;
  }) => (
    <div
      className={className}
      role="presentation"
      onClick={onClick}
      onKeyDown={onKeyDown}>
      {children}
    </div>
  ),
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock(
  '@untitledui/icons',
  () =>
    new Proxy(
      {},
      {
        get: (_target, name: string) =>
          name === '__esModule' ? false : () => <span />,
      }
    )
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { Task } from '../../../../../generated/entity/tasks/task';
import InboxTaskListItem from './InboxTaskListItem';

const task = {
  id: 't1',
  taskId: '11345',
  displayName: 'Data Access Request for RF3',
  about: { type: 'Table', name: 'dim_customers' },
  createdBy: { id: 'u1', name: 'olivia', displayName: 'Olivia Rhye' },
  assignees: [
    { id: 'a1', name: 'one' },
    { id: 'a2', name: 'two' },
  ],
  commentCount: 2,
  createdAt: 1747000000000,
} as unknown as Task;

describe('InboxTaskListItem', () => {
  it('renders the id, title, requester, asset and comment count', () => {
    render(<InboxTaskListItem task={task} onClick={jest.fn()} />);

    expect(screen.getByText('#11345')).toBeInTheDocument();
    expect(screen.getByText('Data Access Request for RF3')).toBeInTheDocument();
    expect(screen.getByText('Olivia Rhye')).toBeInTheDocument();
    expect(screen.getByText('dim_customers')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  // The type is carried by the list's group header, so repeating it on every
  // card would be noise.
  it('does not repeat the task type on the card', () => {
    render(<InboxTaskListItem task={task} onClick={jest.fn()} />);

    expect(screen.queryByText('Table')).not.toBeInTheDocument();
  });

  // The type lives in a tinted icon at the start of the row, not a text badge.
  it('leads the card with the task type icon', () => {
    render(<InboxTaskListItem task={task} onClick={jest.fn()} />);

    expect(screen.getByTestId('task-type-icon')).toBeInTheDocument();
  });

  it('leaves the asset chip off a task that names no entity', () => {
    render(
      <InboxTaskListItem
        task={{ ...task, about: undefined } as Task}
        onClick={jest.fn()}
      />
    );

    expect(screen.queryByText('dim_customers')).not.toBeInTheDocument();
  });

  it('composes a title for a task whose name is only the taskId', () => {
    render(
      <InboxTaskListItem
        task={{ ...task, displayName: undefined, name: '11345' } as Task}
        onClick={jest.fn()}
      />
    );

    expect(screen.getByText('#11345')).toBeInTheDocument();
    // The bare id never doubles as the title.
    expect(screen.queryByText('11345')).not.toBeInTheDocument();
    expect(screen.getByText('Approval request for orders')).toBeInTheDocument();
  });

  // The list shows a short reference; the detail header keeps "TASK-…".
  it('drops the TASK- prefix from the id', () => {
    render(
      <InboxTaskListItem
        task={{ ...task, taskId: 'TASK-00357' } as Task}
        onClick={jest.fn()}
      />
    );

    expect(screen.getByText('#00357')).toBeInTheDocument();
  });

  it('shows no comment count when there are none', () => {
    render(
      <InboxTaskListItem
        task={{ ...task, commentCount: 0 } as Task}
        onClick={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('inbox-task-comment-count')
    ).not.toBeInTheDocument();
  });

  it('fires onClick with the task', () => {
    const onClick = jest.fn();
    render(<InboxTaskListItem task={task} onClick={onClick} />);

    fireEvent.click(screen.getByText('#11345'));

    expect(onClick).toHaveBeenCalledWith(task);
  });
});
