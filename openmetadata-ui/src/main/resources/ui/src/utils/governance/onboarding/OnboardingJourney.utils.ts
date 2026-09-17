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
import { Operation } from '../../../generated/entity/policies/accessControl/resourcePermission';
import {
  IntakeFormField,
  OnboardingProgress,
  OnboardingStepResult,
  State,
  Type,
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
  if (blockers.some((result) => result.step.type === Type.Field)) {
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
