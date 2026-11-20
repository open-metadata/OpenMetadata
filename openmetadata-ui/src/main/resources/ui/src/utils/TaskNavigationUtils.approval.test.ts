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
import {
  ReviewVoteDecision,
  Task,
  TaskCategory,
  TaskStatus,
  TaskType,
} from '../generated/entity/tasks/task';
import { EntityReference } from '../generated/entity/type';
import {
  getCurrentStageVotes,
  hasVotedInCurrentStage,
  isAllowedDecider,
  isDecidedByAssignees,
} from './TaskNavigationUtils';

const ALICE: EntityReference = { id: 'alice-id', type: 'user', name: 'alice' };
const STEWARDS: EntityReference = {
  id: 'stewards-id',
  type: 'team',
  name: 'stewards',
};

const vote = (stage: string) => ({
  voter: ALICE,
  assignee: ALICE,
  decision: ReviewVoteDecision.Approved,
  stage,
  timestamp: 1,
});

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-id',
  name: 'TASK-1',
  category: TaskCategory.Approval,
  type: TaskType.RequestApproval,
  status: TaskStatus.Open,
  createdBy: ALICE,
  workflowInstanceId: 'wf-1',
  workflowStageId: 'review',
  assignees: [STEWARDS],
  ...overrides,
});

describe('getCurrentStageVotes / hasVotedInCurrentStage', () => {
  it('counts only the votes cast in the current stage', () => {
    const voted = task({ reviewVotes: [vote('draft'), vote('review')] });

    expect(getCurrentStageVotes(voted)).toEqual([vote('review')]);
    expect(hasVotedInCurrentStage(voted, { id: 'alice-id' })).toBe(true);
  });

  it('treats a vote from an earlier stage as not yet voted', () => {
    expect(
      hasVotedInCurrentStage(task({ reviewVotes: [vote('draft')] }), {
        id: 'alice-id',
      })
    ).toBe(false);
  });

  it('is false without a known viewer', () => {
    expect(
      hasVotedInCurrentStage(task({ reviewVotes: [vote('review')] }), {})
    ).toBe(false);
    expect(hasVotedInCurrentStage(task(), undefined)).toBe(false);
  });
});

describe('isDecidedByAssignees / isAllowedDecider', () => {
  it('applies to a workflow change-request review as well as a RequestApproval', () => {
    expect(
      isDecidedByAssignees(
        task({
          type: TaskType.Suggestion,
          payload: { changeRequestId: 'cr-1' },
        })
      )
    ).toBe(true);
  });

  it('does not apply outside a workflow', () => {
    const legacy = task({ workflowInstanceId: undefined });

    expect(isDecidedByAssignees(legacy)).toBe(false);
    expect(isAllowedDecider(legacy, new Set(['someone-else']))).toBe(true);
  });

  it('lets an assigned team member decide and refuses everyone else', () => {
    expect(isAllowedDecider(task(), new Set(['bob-id', 'stewards-id']))).toBe(
      true
    );
    expect(isAllowedDecider(task(), new Set(['bob-id']))).toBe(false);
  });
});
