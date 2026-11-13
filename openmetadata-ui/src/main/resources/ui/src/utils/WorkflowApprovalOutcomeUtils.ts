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

export enum ApprovalOutcomeKind {
  AutoApproved = 'autoApproved',
  AutoApprovedSubmitterIsReviewer = 'autoApprovedSubmitterIsReviewer',
  Approved = 'approved',
  Rejected = 'rejected',
}

export interface ApprovalOutcome {
  node: string;
  kind: ApprovalOutcomeKind;
  decidedAt?: number;
  decidedBy?: string;
}

/** The message each outcome reads as; Approved and Rejected take the deciding user as `user`. */
export const APPROVAL_OUTCOME_LABELS: Record<ApprovalOutcomeKind, string> = {
  [ApprovalOutcomeKind.AutoApproved]: 'message.workflow-run-auto-approved',
  [ApprovalOutcomeKind.AutoApprovedSubmitterIsReviewer]:
    'message.workflow-run-auto-approved-submitter-is-reviewer',
  [ApprovalOutcomeKind.Approved]: 'message.workflow-run-approved-by',
  [ApprovalOutcomeKind.Rejected]: 'message.workflow-run-rejected-by',
};

const APPROVED_RESULTS = new Set(['true', 'approve', 'approved']);
const REJECTED_RESULTS = new Set(['false', 'reject', 'rejected']);

/** Whether an approval step's result variable reads as approved, rejected, or neither. */
const readDecision = (result: unknown): boolean | undefined => {
  const value = String(result ?? '')
    .trim()
    .toLowerCase();
  let approved: boolean | undefined;
  if (APPROVED_RESULTS.has(value)) {
    approved = true;
  } else if (REJECTED_RESULTS.has(value)) {
    approved = false;
  }

  return approved;
};

type StepVariables = Record<string, unknown>;

/** Who decided a step the workflow approved itself, read from the pass's own variables. */
const readAutomaticKind = (
  variables: StepVariables
): ApprovalOutcomeKind | undefined => {
  const submitterIsReviewer = variables.submitterIsReviewer === true;
  let kind: ApprovalOutcomeKind | undefined;
  if (submitterIsReviewer) {
    kind = ApprovalOutcomeKind.AutoApprovedSubmitterIsReviewer;
  } else if (variables.hasAssignees === false) {
    kind = ApprovalOutcomeKind.AutoApproved;
  }

  return kind;
};

const readDecidedStep = (
  node: string,
  variables: StepVariables
): Pick<ApprovalOutcome, 'kind' | 'decidedBy'> | undefined => {
  const approved = readDecision(variables[`${node}_result`]);
  const automaticKind = variables[`${node}_autoApprovalReason`]
    ? readAutomaticKind(variables)
    : undefined;
  const decidedBy = variables[`${node}_updatedBy`];
  let decided: Pick<ApprovalOutcome, 'kind' | 'decidedBy'> | undefined;
  if (automaticKind && approved) {
    decided = { kind: automaticKind };
  } else if (typeof decidedBy === 'string' && approved !== undefined) {
    decided = {
      kind: approved
        ? ApprovalOutcomeKind.Approved
        : ApprovalOutcomeKind.Rejected,
      decidedBy,
    };
  }

  return decided;
};

/**
 * How one recorded step was decided, when it is an approval step: the auto-approve step records
 * `<node>_autoApprovalReason`, and a person resolving the task records `<node>_updatedBy` with the
 * `<node>_result` they chose. Any other step, or one that has not been decided, reads as undefined.
 * A run that loops back to the same step keeps the earlier pass's variables, so an automatic pass,
 * and why it was automatic, is told by `hasAssignees` or `submitterIsReviewer`, which every pass
 * sets afresh. The variable names are the contract in
 * ADR:2026-11-13-the-ui-reads-an-approval-steps-outcome-from-its-recorded-variables.
 */
export const getApprovalOutcome = (
  state: WorkflowInstanceState
): ApprovalOutcome | undefined => {
  const node = state.stage?.name;
  const decided = node
    ? readDecidedStep(node, state.stage?.variables ?? {})
    : undefined;

  return node && decided
    ? { node, decidedAt: state.stage?.endedAt, ...decided }
    : undefined;
};

/** The approval steps of one run, in the order they were decided. */
export const getApprovalOutcomes = (
  states: WorkflowInstanceState[]
): ApprovalOutcome[] =>
  states
    .map(getApprovalOutcome)
    .filter((outcome): outcome is ApprovalOutcome => outcome !== undefined)
    .sort((a, b) => (a.decidedAt ?? 0) - (b.decidedAt ?? 0));
