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
import { WorkflowInstanceState } from '../generated/governance/workflows/workflowInstanceState';
import {
  ApprovalOutcomeKind,
  getApprovalOutcomes,
} from './WorkflowApprovalOutcomeUtils';

// Variables as the server records them on an approval step, copied from real runs.
const step = (
  name: string,
  endedAt: number,
  variables: Record<string, unknown>
): WorkflowInstanceState => ({
  stage: { name, endedAt, variables },
});

const autoApproved = step('ReviewDescription', 300, {
  hasAssignees: false,
  ReviewDescription_result: 'approve',
  ReviewDescription_autoApprovalReason: 'No reviewers configured',
});

const approvedByDaniel = step('ReviewDescription', 200, {
  hasAssignees: true,
  ReviewDescription_result: 'approve',
  ReviewDescription_updatedBy: 'daniel.okafor',
});

describe('getApprovalOutcomes', () => {
  it('reads a step the workflow approved itself for lack of assignees', () => {
    expect(getApprovalOutcomes([autoApproved])).toEqual([
      {
        node: 'ReviewDescription',
        decidedAt: 300,
        kind: ApprovalOutcomeKind.AutoApproved,
      },
    ]);
  });

  it('tells apart a step approved because the submitter is the reviewer', () => {
    const [outcome] = getApprovalOutcomes([
      step('Review', 1, {
        submitterIsReviewer: true,
        Review_result: true,
        Review_autoApprovalReason: 'Submitter is a reviewer',
      }),
    ]);

    expect(outcome.kind).toBe(
      ApprovalOutcomeKind.AutoApprovedSubmitterIsReviewer
    );
  });

  it('reads who approved or rejected a step, in either result form', () => {
    expect(
      getApprovalOutcomes([
        approvedByDaniel,
        step('Review', 100, {
          hasAssignees: true,
          Review_result: false,
          Review_updatedBy: 'priya.nair',
        }),
      ])
    ).toEqual([
      {
        node: 'Review',
        decidedAt: 100,
        kind: ApprovalOutcomeKind.Rejected,
        decidedBy: 'priya.nair',
      },
      {
        node: 'ReviewDescription',
        decidedAt: 200,
        kind: ApprovalOutcomeKind.Approved,
        decidedBy: 'daniel.okafor',
      },
    ]);
  });

  it('credits the person when a looped step kept the reason from an earlier automatic pass', () => {
    const [outcome] = getApprovalOutcomes([
      step('ReviewDescription', 1, {
        hasAssignees: true,
        ReviewDescription_result: 'approve',
        ReviewDescription_autoApprovalReason: 'No reviewers configured',
        ReviewDescription_updatedBy: 'daniel.okafor',
      }),
    ]);

    expect(outcome).toEqual(
      expect.objectContaining({
        kind: ApprovalOutcomeKind.Approved,
        decidedBy: 'daniel.okafor',
      })
    );
  });

  it('skips steps that are not decided approvals', () => {
    expect(
      getApprovalOutcomes([
        step('Start', 1, { hasAssignees: true }),
        // Another node's decision is visible to every later step; only a step's own counts.
        step('ApprovedEnd', 2, {
          ReviewDescription_result: 'approve',
          ReviewDescription_updatedBy: 'daniel.okafor',
        }),
        step('ReviewDescription', 3, {
          ReviewDescription_result: 'timeout',
          ReviewDescription_updatedBy: 'daniel.okafor',
        }),
        { stage: { variables: { hasAssignees: false } } },
      ])
    ).toEqual([]);
  });
});
