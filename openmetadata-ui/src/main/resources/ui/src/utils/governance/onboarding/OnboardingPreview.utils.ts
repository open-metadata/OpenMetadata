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
  IntakeForm,
  OnboardingStage,
  OnboardingStep,
  Role,
} from '../../../generated/governance/intakeForm';
import {
  EntityStatus,
  OnboardingProgress,
  OnboardingStepResult,
  State,
  Type,
} from '../../../generated/governance/onboarding/onboardingProgress';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import { EntityReference } from '../../../generated/type/entityReference';
import { getIntakeFormFields } from '../../IntakeFormUtils';
import {
  CREATION_FIELDS,
  getStepState,
  isRecord,
  ONBOARDING_STAGES,
  stepsAtStage,
} from './Onboarding.utils';
import { isCheckComplete } from './OnboardingJourney.utils';

export const previewReferences = (value: unknown): EntityReference[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is EntityReference =>
          isRecord(item) &&
          typeof item.id === 'string' &&
          typeof item.type === 'string'
      )
    : [];

export const withPreviewValue = (
  values: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> => {
  const [key, ...rest] = path.split('.');
  const current = values[key];

  if (!rest.length) {
    return { ...values, [key]: value };
  }
  const nested = isRecord(current) ? current : {};

  return { ...values, [key]: withPreviewValue(nested, rest.join('.'), value) };
};

const uniqueReferences = (refs: EntityReference[]) =>
  refs.filter(
    (ref, index) =>
      refs.findIndex(
        (candidate) => candidate.id === ref.id && candidate.type === ref.type
      ) === index
  );

export interface PreviewContext {
  form: IntakeForm;
  values: Record<string, unknown>;
  stage: OnboardingStage;
  creator: EntityReference;
  workflows: WorkflowDefinition[];
  domainOwners: EntityReference[];
  decisions: Record<string, State>;
}

const approvalAssignees = (step: OnboardingStep, context: PreviewContext) => {
  const workflow = context.workflows.find(
    (item) => item.id === step.workflow?.id
  );

  return uniqueReferences(
    (workflow?.nodes ?? []).flatMap((node) => {
      if (node.subType !== 'userApprovalTask' || !isRecord(node.config)) {
        return [];
      }
      const config = node.config.assignees;
      if (!isRecord(config)) {
        return [];
      }

      return [
        ...previewReferences(config.candidates),
        ...(config.addReviewers
          ? previewReferences(context.values.reviewers)
          : []),
        ...(config.addOwners ? previewReferences(context.values.owners) : []),
      ];
    })
  );
};

const fieldAssignees = (step: OnboardingStep, context: PreviewContext) => {
  switch (step.assignment?.role ?? Role.Creator) {
    case Role.Creator:
      return [context.creator];
    case Role.Owners:
      return previewReferences(context.values.owners);
    case Role.Experts:
      return previewReferences(context.values.experts);
    case Role.DomainOwners:
      return context.domainOwners;
    case Role.Explicit:
      return step.assignment?.assignees ?? [];
  }
};

const previewState = (context: PreviewContext, step: OnboardingStep) => {
  const evaluated = getStepState(step, context.values);
  const state =
    Object.values(State).find((state) => state === evaluated) ?? State.Pending;
  if (step.type !== Type.Approval || state === State.NotApplicable) {
    return state;
  }
  const workflow = context.workflows.find(
    (item) => item.id === step.workflow?.id
  );
  if (
    !workflow ||
    workflow.deleted ||
    workflow.suspended ||
    !workflow.deployed
  ) {
    return State.Failed;
  }

  return context.decisions[step.id] ?? State.Pending;
};

const previewStep = (
  context: PreviewContext,
  stage: OnboardingStage,
  step: OnboardingStep
): OnboardingStepResult => {
  const field = getIntakeFormFields(context.form).find(
    (candidate) => candidate.fieldPath === step.fieldPath
  );
  const intrinsic = CREATION_FIELDS[context.form.entityType].includes(
    step.fieldPath ?? ''
  );
  const required =
    step.type === Type.Approval || Boolean(field?.required) || intrinsic;
  const assignees =
    step.type === Type.Approval
      ? approvalAssignees(step, context)
      : fieldAssignees(step, context);
  const state = previewState(context, step);
  const unresolved =
    required &&
    !assignees.length &&
    state !== State.Complete &&
    state !== State.NotApplicable;

  return {
    step,
    field,
    required,
    assignees,
    state: unresolved ? State.Blocked : state,
    stage,
  };
};

export const previewProgress = (
  context: PreviewContext
): OnboardingProgress => {
  const { form, stage } = context;
  const steps = ONBOARDING_STAGES.filter(
    (item) =>
      ONBOARDING_STAGES.indexOf(item) <= ONBOARDING_STAGES.indexOf(stage)
  ).flatMap((item) =>
    stepsAtStage(form, item).map((step) => previewStep(context, item, step))
  );
  const blockingSteps = steps
    .filter((result) => result.required && !isCheckComplete(result))
    .map((result) => result.step.id);
  const next = ONBOARDING_STAGES[ONBOARDING_STAGES.indexOf(stage) + 1];

  return {
    stage,
    configurationVersion: form.version,
    canAdvance: !blockingSteps.length,
    blockingSteps,
    steps,
    nextStatus: Object.values(EntityStatus).find(
      (status) => status === String(next)
    ),
    completed:
      !blockingSteps.length &&
      (stage === OnboardingStage.Approved ||
        stage === OnboardingStage.Deprecated),
  };
};
