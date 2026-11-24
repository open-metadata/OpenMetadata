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
  ApprovalOutcome,
  AutomaticReason,
  Decision,
} from '../generated/governance/workflows/approvalOutcome';
import {
  getApprovalOutcomeMessage,
  getLatestApprovalOutcome,
  getRunApprovals,
} from './WorkflowApprovalOutcomeUtils';

const outcome = (overrides: Partial<ApprovalOutcome>): ApprovalOutcome => ({
  id: 'outcome',
  node: 'Review',
  decision: Decision.Approved,
  decidedAt: 1,
  decidedBy: [],
  ...overrides,
});

describe('getApprovalOutcomeMessage', () => {
  it('says why the workflow approved a step itself', () => {
    expect(
      getApprovalOutcomeMessage(
        outcome({ automaticReason: AutomaticReason.NoAssignees })
      )
    ).toEqual({ key: 'message.workflow-run-auto-approved' });
    expect(
      getApprovalOutcomeMessage(
        outcome({ automaticReason: AutomaticReason.SubmitterIsReviewer })
      )
    ).toEqual({
      key: 'message.workflow-run-auto-approved-submitter-is-reviewer',
    });
  });

  it('names every user whose vote decided the step', () => {
    expect(
      getApprovalOutcomeMessage(
        outcome({ decidedBy: ['daniel.okafor', 'priya.nair'] })
      )
    ).toEqual({
      key: 'message.workflow-run-approved-by',
      users: 'daniel.okafor, priya.nair',
    });
    expect(
      getApprovalOutcomeMessage(
        outcome({
          decision: Decision.PartiallyApproved,
          decidedBy: ['daniel.okafor'],
        })
      ).key
    ).toBe('message.workflow-run-partially-approved-by');
    expect(
      getApprovalOutcomeMessage(
        outcome({ decision: Decision.Rejected, decidedBy: ['priya.nair'] })
      ).key
    ).toBe('message.workflow-run-rejected-by');
  });
});

describe('getLatestApprovalOutcome', () => {
  it("picks the node's latest decision when the step ran more than once", () => {
    const approvals = [
      outcome({ id: 'first', decidedAt: 1 }),
      outcome({ id: 'other-node', node: 'Publish', decidedAt: 3 }),
      outcome({ id: 'second', decidedAt: 2 }),
    ];

    expect(getLatestApprovalOutcome(approvals, 'Review')?.id).toBe('second');
    expect(getLatestApprovalOutcome(approvals, 'Missing')).toBeUndefined();
  });
});

describe('getRunApprovals', () => {
  it('reads the approvals a run keeps in its variables, and none when they are missing', () => {
    const approvals = [outcome({ id: 'kept' })];

    expect(getRunApprovals({ variables: { approvals } })).toEqual(approvals);
    expect(getRunApprovals({ variables: { approvals: 'not a list' } })).toEqual(
      []
    );
    expect(getRunApprovals({})).toEqual([]);
    expect(getRunApprovals(undefined)).toEqual([]);
  });

  it('says an administrator published the change without review', () => {
    expect(
      getApprovalOutcomeMessage(
        outcome({ decision: Decision.Overridden, decidedBy: ['admin'] })
      )
    ).toEqual({ key: 'message.workflow-run-overridden-by', users: 'admin' });
  });
});
