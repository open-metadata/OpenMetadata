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
import { ReactNode } from 'react';

// Boundary stub: the real chip renders the OSS user popover.
jest.mock('components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../inbox.utils', () => ({
  formatActivityTime: () => '13 days ago',
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import TaskActivityTimeline from './TaskActivityTimeline';
import { Task } from '../../../../../generated/entity/tasks/task';

const task = {
  comments: [
    {
      id: 'c1',
      author: { name: 'pb', displayName: 'Phoenix Baker' },
      createdAt: 1,
      message: 'hi',
    },
  ],
  assignees: [{ id: 'a1', name: 'as', displayName: 'Assignee One' }],
  createdBy: { id: 'u1', name: 'oy', displayName: 'Olivia Rhye' },
  createdAt: 2,
} as unknown as Task;

describe('TaskActivityTimeline', () => {
  it('renders comment, assignment and creation events', () => {
    render(<TaskActivityTimeline task={task} />);

    expect(screen.getByText('Phoenix Baker')).toBeInTheDocument();
    expect(screen.getByText('label.added-a-comment')).toBeInTheDocument();
    expect(screen.getByText('Assignee One')).toBeInTheDocument();
    expect(screen.getByText('label.assigned-to')).toBeInTheDocument();
    expect(screen.getByText('Olivia Rhye')).toBeInTheDocument();
    expect(screen.getByText('label.request-created-by')).toBeInTheDocument();
  });

  it('renders only the creation event when there are no comments/assignees', () => {
    render(
      <TaskActivityTimeline
        task={
          {
            createdBy: { name: 'x', displayName: 'X' },
            createdAt: 1,
          } as unknown as Task
        }
      />
    );

    expect(screen.getByText('label.request-created-by')).toBeInTheDocument();
    expect(screen.queryByText('label.added-a-comment')).not.toBeInTheDocument();
  });
});
