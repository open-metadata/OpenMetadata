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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  OnboardingGate,
  Role,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { Operation } from '../../../generated/entity/policies/accessControl/resourcePermission';
import {
  CheckType,
  IntakeFormField,
  OnboardingProgress,
  OnboardingStepResult,
  State,
} from '../../../generated/governance/onboarding/onboardingProgress';
import { EntityReference } from '../../../generated/type/entityReference';

export interface OnboardingViewer {
  id: string;
  teams?: EntityReference[];
}

export const isCheckComplete = (result: OnboardingStepResult) =>
  result.state === State.Complete || result.state === State.NotApplicable;

export const isAssignedToViewer = (
  result: OnboardingStepResult,
  viewer?: OnboardingViewer
) =>
  Boolean(
    viewer &&
      result.assignees?.some((assignee) =>
        assignee.type === 'user'
          ? assignee.id === viewer.id
          : assignee.type === 'team' &&
            viewer.teams?.some((team) => team.id === assignee.id)
      )
  );

export const groupJourneySteps = (
  steps: OnboardingStepResult[],
  viewer?: OnboardingViewer
) => ({
  mine: steps.filter((result) => isAssignedToViewer(result, viewer)),
  others: steps.filter(
    (result) => result.assignees?.length && !isAssignedToViewer(result, viewer)
  ),
  unassigned: steps.filter((result) => !result.assignees?.length),
});

export const journeyInitialStep = (
  steps: OnboardingStepResult[],
  viewer?: OnboardingViewer
) =>
  steps.find(
    (result) => !isCheckComplete(result) && isAssignedToViewer(result, viewer)
  )?.step.id ??
  steps.find((result) => !isCheckComplete(result))?.step.id ??
  steps[0]?.step.id;

export const canRequestTransition = (progress: OnboardingProgress) => {
  if (progress.paused || progress.completed) {
    return false;
  }
  if (progress.canAdvance) {
    return true;
  }
  const blockers = progress.steps.filter(
    (result) => result.required && !isCheckComplete(result)
  );
  if (blockers.some((result) => result.step.type !== CheckType.Approval)) {
    return false;
  }

  // Only the server can distinguish stale approvals from active executions to reuse.
  return blockers.length > 0;
};

export const canEditOnboardingField = (
  permissions: OperationPermission,
  field: IntakeFormField
) => {
  if (permissions.All || permissions.EditAll) {
    return true;
  }
  if (field.fieldPath.startsWith('extension.')) {
    return permissions.EditCustomFields;
  }
  if (field.fieldPath === 'tags') {
    return (
      permissions.EditTags ||
      permissions.EditGlossaryTerms ||
      permissions.EditTier ||
      permissions.EditCertification
    );
  }
  const operations: Record<string, keyof OperationPermission> = {
    description: Operation.EditDescription,
    displayName: Operation.EditDisplayName,
    owners: Operation.EditOwners,
    reviewers: Operation.EditReviewers,
  };
  const operation = operations[field.fieldPath];

  return operation ? permissions[operation] : false;
};

export const canEditOnboardingTag = (
  permissions: OperationPermission | undefined,
  tag: EntityReference
) => {
  if (!permissions || permissions.All || permissions.EditAll) {
    return true;
  }
  const fqn = tag.fullyQualifiedName ?? tag.name ?? '';
  if (fqn.startsWith('Tier.')) {
    return permissions.EditTier;
  }
  if (fqn.startsWith('Certification.')) {
    return permissions.EditCertification;
  }

  return tag.type === 'glossaryTerm'
    ? permissions.EditGlossaryTerms
    : permissions.EditTags;
};

export const checkRequirementLabel = (result: OnboardingStepResult) => {
  if (result.required) {
    return 'label.required';
  }

  return result.field?.recommended ? 'label.recommended' : 'label.optional';
};

export const checkStateColor = (state: State) => {
  if (state === State.Complete) {
    return 'success';
  }
  if (state === State.Failed || state === State.Rejected) {
    return 'error';
  }

  return state === State.Blocked ? 'warning' : 'gray';
};

export const assigneeInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const blockingProgress = (steps: OnboardingStepResult[]) => {
  const required = steps.filter((result) => result.required);

  return {
    complete: required.filter(isCheckComplete).length,
    total: required.length,
  };
};

/** Blocking checks the viewer is asked for and has not finished - what the wizard counts down. */
/** An approval is the workflow's decision, never something the producer fills in. */
const isProducerWork = (result: OnboardingStepResult) =>
  result.step.type !== CheckType.Approval;

export const openBlockingMine = (
  steps: OnboardingStepResult[],
  viewer?: OnboardingViewer
) =>
  steps.filter(
    (result) =>
      result.required &&
      isProducerWork(result) &&
      !isCheckComplete(result) &&
      isAssignedToViewer(result, viewer)
  );

/** Blocking checks that belong to someone else - the producer waits on them but is not blocked. */
export const othersOpenBlocking = (
  steps: OnboardingStepResult[],
  viewer?: OnboardingViewer
) =>
  steps.filter(
    (result) =>
      result.required &&
      !isCheckComplete(result) &&
      !isAssignedToViewer(result, viewer)
  );

/**
 * How far the producer is through their own blocking checks. A producer with nothing asked of them
 * is finished rather than at zero, so an empty ring would read as work outstanding.
 */
export const producerProgress = (
  steps: OnboardingStepResult[],
  viewer?: OnboardingViewer
) => {
  const mine = steps.filter(
    (result) =>
      result.required &&
      isProducerWork(result) &&
      isAssignedToViewer(result, viewer)
  );
  const complete = mine.filter(isCheckComplete).length;

  return {
    complete,
    total: mine.length,
    percent:
      mine.length === 0 ? 100 : Math.round((complete / mine.length) * 100),
  };
};

/** The check a board row is waiting on: the first blocking one still open. */
export const firstOpenBlocking = (steps: OnboardingStepResult[]) =>
  steps.find((result) => result.required && !isCheckComplete(result));

/** Days a gate tolerates before it counts as stalled; the design's default is five. */
export const DEFAULT_STALL_DAYS = 5;

/** The server's cooldown between two reminders for the same check. */
export const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the assignee has already been reminded recently enough that the server would refuse a
 * second reminder. Reading it from the step rather than from local state is what makes `Nudged`
 * survive a reload.
 */
export const wasRemindedRecently = (
  result: OnboardingStepResult | undefined,
  now: number = Date.now()
) =>
  Boolean(
    result?.lastReminderAt && now - result.lastReminderAt < REMINDER_COOLDOWN_MS
  );

/**
 * Whether an asset has sat in its stage longer than the gate tolerates. The gate's own stall window
 * is used when it has one so the board and the notification agree on what "late" means.
 */
export const isLate = (
  enteredAt: number | undefined,
  gate?: OnboardingGate,
  now: number = Date.now()
) => {
  if (!enteredAt) {
    return false;
  }
  const days = gate?.notifyOnStall?.enabled
    ? gate.notifyOnStall.afterDays ?? DEFAULT_STALL_DAYS
    : DEFAULT_STALL_DAYS;

  return now - enteredAt > days * 24 * 60 * 60 * 1000;
};

/**
 * The checks the wizard walks the producer through: what this stage asks for, plus anything an
 * earlier soft gate let through unfinished. Checks already met at an earlier stage are history and
 * would only pad the count. A result that does not say which stage it came from is treated as this
 * one, so an older payload never hides work.
 */
export const journeySteps = (progress: OnboardingProgress) =>
  progress.steps.filter(
    (result) =>
      (result.stage ?? progress.stage) === progress.stage ||
      !isCheckComplete(result)
  );

/**
 * Whether the viewer is the person the playbook calls the creator. The server resolves the
 * `creator` role to whoever filed the asset, so their own checks answer the question without the
 * asset having to carry a separate author field.
 */
export const isCreatedByViewer = (
  progress: OnboardingProgress,
  viewer?: OnboardingViewer
) =>
  progress.steps.some(
    (result) =>
      (result.step.assignment?.role ?? Role.Creator) === Role.Creator &&
      isAssignedToViewer(result, viewer)
  );

/** A check on someone else's desk: it has assignees, and none of them is the viewer. */
export const isWithOthers = (
  result: OnboardingStepResult,
  viewer?: OnboardingViewer
) => Boolean(result.assignees?.length) && !isAssignedToViewer(result, viewer);

/**
 * Whether the producer may ask for the transition at all. A soft gate lets the asset through with
 * checks open; a hard one only yields once the server says so, or when the only thing left is work
 * the server has to re-check anyway.
 */
export const canSubmitForReview = (progress: OnboardingProgress) =>
  Boolean(progress.canAdvance) ||
  progress.gateBlocking === false ||
  canRequestTransition(progress);

/**
 * True when everything still holding the gate is an approval: the workflow owns that decision, so
 * the producer has nothing to submit and the CTA says so instead of offering a transition.
 */
export const isWaitingForApproval = (progress: OnboardingProgress) => {
  if (
    progress.canAdvance ||
    progress.gateBlocking === false ||
    progress.completed
  ) {
    return false;
  }
  const blockers = progress.steps.filter(
    (result) => result.required && !isCheckComplete(result)
  );

  return (
    blockers.length > 0 &&
    blockers.every((result) => result.step.type === CheckType.Approval)
  );
};
