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
import { Task } from '../../../../../generated/entity/tasks/task';
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
});
