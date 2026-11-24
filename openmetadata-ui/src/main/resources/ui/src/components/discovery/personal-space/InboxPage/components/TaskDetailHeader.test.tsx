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
import { Task, TaskStatus } from '../../../../../generated/entity/tasks/task';
import { TaskResolveAction } from '../taskResolve.utils';
import TaskDetailHeader from './TaskDetailHeader';

jest.mock(
  '../../../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  })
);

const action = (
  id: string,
  kind: TaskResolveAction['kind']
): TaskResolveAction => ({ id, label: id, kind, requiresComment: false });

// Approve and reject take the header slots, so the rest go to the menu.
const ACTIONS = [
  action('approve', 'approve'),
  action('reject', 'reject'),
  action('escalate', 'other'),
  action('defer', 'other'),
];

const renderHeader = (loadingTransitionId?: string) =>
  render(
    <TaskDetailHeader
      actions={ACTIONS}
      loadingTransitionId={loadingTransitionId}
      task={{ id: 'task-1', taskId: 'TASK-1' } as Task}
      typeBadge={{ label: 'Approval', color: 'gray', icon: 'approval' }}
      onAssigneeUpdate={() => jest.fn()}
      onTransition={() => jest.fn()}
    />
  );

describe('TaskDetailHeader', () => {
  it('offers the overflow menu while no transition runs', () => {
    renderHeader();

    expect(screen.getByTestId('task-actions-menu')).toBeEnabled();
  });

  // A second transition must not start from the menu while one is in flight.
  it('disables the overflow menu while a transition runs', () => {
    renderHeader('approve');

    expect(screen.getByTestId('task-actions-menu')).toBeDisabled();
  });

  // Passed as an element, the icon kept its own 16px and the menu button sat
  // 4px shorter than Reject and Approve beside it.
  it('lets the button size the overflow icon like its neighbours', () => {
    renderHeader();

    expect(
      screen.getByTestId('task-actions-menu').querySelector('[data-icon]')
    ).toBeInTheDocument();
  });

  it('shows Resolve and Reassign on an assigned incident and folds the steps back', () => {
    const transition = (id: string, targetStageId: string) => ({
      ...action(id, id === 'reassign' ? 'assignee' : 'other'),
      transition: {
        id,
        label: id,
        targetStageId,
        targetTaskStatus: TaskStatus.InProgress,
      },
    });

    render(
      <TaskDetailHeader
        actions={[
          transition('new', 'new'),
          transition('ack', 'ack'),
          transition('reassign', 'assigned'),
          transition('resolve', 'resolved'),
        ]}
        task={
          {
            id: 'task-1',
            taskId: 'TASK-1',
            workflowStageId: 'assigned',
          } as Task
        }
        typeBadge={{ label: 'Incident', color: 'gray', icon: 'incident' }}
        onAssigneeUpdate={() => jest.fn()}
        onTransition={() => jest.fn()}
      />
    );

    expect(screen.getByTestId('task-transition-resolve')).toBeVisible();
    expect(screen.getByTestId('task-transition-reassign')).toBeVisible();
    expect(screen.getByTestId('task-actions-menu')).toBeVisible();
    expect(screen.queryByTestId('task-transition-new')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-transition-ack')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('task-actions-menu'));

    expect(screen.getByTestId('task-transition-new')).toBeInTheDocument();
    expect(screen.getByTestId('task-transition-ack')).toBeInTheDocument();
  });
});
