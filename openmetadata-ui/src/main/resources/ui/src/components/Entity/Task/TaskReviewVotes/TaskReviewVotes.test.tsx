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
import {
  ReviewVoteDecision,
  Task,
  TaskCategory,
  TaskStatus,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { EntityReference } from '../../../../generated/entity/type';
import TaskReviewVotes from './TaskReviewVotes';

jest.mock('../../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(null)
);

const BOB: EntityReference = { id: 'bob-id', type: 'user', name: 'bob' };

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-id',
  name: 'TASK-1',
  category: TaskCategory.Approval,
  type: TaskType.RequestApproval,
  status: TaskStatus.Open,
  createdBy: BOB,
  workflowStageId: 'review',
  reviewVotes: [
    {
      voter: BOB,
      assignee: BOB,
      decision: ReviewVoteDecision.Rejected,
      stage: 'review',
      timestamp: 1,
    },
  ],
  ...overrides,
});

describe('TaskReviewVotes', () => {
  it('names a rejecting voter', () => {
    render(<TaskReviewVotes task={task()} />);

    expect(screen.getByTestId('task-review-votes')).toHaveTextContent(
      'message.user-rejected-task'
    );
  });

  it('tells the voter they wait for the others only while the task is open', () => {
    const { rerender } = render(
      <TaskReviewVotes currentUserId="bob-id" task={task()} />
    );

    expect(screen.getByTestId('task-review-votes-waiting')).toBeInTheDocument();

    rerender(
      <TaskReviewVotes
        currentUserId="bob-id"
        task={task({ status: TaskStatus.Rejected })}
      />
    );

    expect(
      screen.queryByTestId('task-review-votes-waiting')
    ).not.toBeInTheDocument();
  });

  it('renders nothing when no one has voted in this stage', () => {
    render(<TaskReviewVotes task={task({ workflowStageId: 'approved' })} />);

    expect(screen.queryByTestId('task-review-votes')).not.toBeInTheDocument();
  });
});
