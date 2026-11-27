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
import { WorkflowInstance } from '../generated/governance/workflows/workflowInstance';

export interface ApprovalOutcomeMessage {
  key: string;
  users?: string;
}

const AUTOMATIC_MESSAGES: Record<AutomaticReason, string> = {
  [AutomaticReason.NoAssignees]: 'message.workflow-run-auto-approved',
  [AutomaticReason.SubmitterIsReviewer]:
    'message.workflow-run-auto-approved-submitter-is-reviewer',
};

const VOTED_MESSAGES: Record<Decision, string> = {
  [Decision.Approved]: 'message.workflow-run-approved-by',
  [Decision.PartiallyApproved]: 'message.workflow-run-partially-approved-by',
  [Decision.Rejected]: 'message.workflow-run-rejected-by',
  [Decision.Overridden]: 'message.workflow-run-overridden-by',
};

/**
 * The approval steps a run recorded, kept in its variables under `approvals` so a run stays
 * readable by every server version. Variables are untyped, so the list is checked before use.
 */
export const getRunApprovals = (run?: WorkflowInstance): ApprovalOutcome[] => {
  const approvals = run?.variables?.approvals;

  return Array.isArray(approvals) ? (approvals as ApprovalOutcome[]) : [];
};

/**
 * The message an approval step's recorded outcome reads as
 * (ADR:2026-11-13-a-workflow-run-records-how-each-approval-step-was-decided).
 */
export const getApprovalOutcomeMessage = (
  outcome: ApprovalOutcome
): ApprovalOutcomeMessage =>
  outcome.automaticReason
    ? { key: AUTOMATIC_MESSAGES[outcome.automaticReason] }
    : {
        key: VOTED_MESSAGES[outcome.decision],
        users: (outcome.decidedBy ?? []).join(', '),
      };

/** The latest decision of the given approval node, when the run recorded one. */
export const getLatestApprovalOutcome = (
  approvals: ApprovalOutcome[],
  node?: string
): ApprovalOutcome | undefined =>
  approvals
    .filter((outcome) => outcome.node === node)
    .reduce<ApprovalOutcome | undefined>(
      (latest, outcome) =>
        !latest || outcome.decidedAt > latest.decidedAt ? outcome : latest,
      undefined
    );
