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
import { EntityType } from '../../../enums/entity.enum';
import {
  CheckType,
  OnboardingCondition,
  OnboardingPlaybook,
  OnboardingStep,
  Operator,
  Requirement,
  TargetEntityType,
} from '../../../generated/entity/governance/onboardingPlaybook';
import {
  FieldKind,
  IntakeFormField,
} from '../../../generated/governance/onboarding/onboardingProgress';
import { ONBOARDING_STAGE } from './Onboarding.constants';

/** Stage keys of the default lifecycle. A playbook may declare its own; these are the fallback. */
export const ONBOARDING_STAGES: string[] = [
  ONBOARDING_STAGE.CREATION,
  ONBOARDING_STAGE.DRAFT,
  ONBOARDING_STAGE.IN_REVIEW,
  ONBOARDING_STAGE.APPROVED,
  ONBOARDING_STAGE.PUBLISHED,
  ONBOARDING_STAGE.DEPRECATED,
];
export const ONBOARDING_ENTITY_TYPES: Record<TargetEntityType, EntityType> = {
  [TargetEntityType.DataProduct]: EntityType.DATA_PRODUCT,
  [TargetEntityType.Domain]: EntityType.DOMAIN,
  [TargetEntityType.GlossaryTerm]: EntityType.GLOSSARY_TERM,
  [TargetEntityType.Metric]: EntityType.METRIC,
};
export const CREATION_FIELDS: Record<TargetEntityType, string[]> = {
  [TargetEntityType.DataProduct]: ['name', 'description', 'domains'],
  [TargetEntityType.Domain]: ['name', 'description', 'domainType'],
  [TargetEntityType.GlossaryTerm]: ['name', 'description', 'glossary'],
  [TargetEntityType.Metric]: ['name'],
};
/** Labels for the default lifecycle. A playbook-declared stage supplies its own displayName. */
export const STAGE_LABELS: Record<string, string> = {
  [ONBOARDING_STAGE.CREATION]: 'label.creation',
  [ONBOARDING_STAGE.DRAFT]: 'label.draft',
  [ONBOARDING_STAGE.IN_REVIEW]: 'label.in-review',
  [ONBOARDING_STAGE.APPROVED]: 'label.approved',
  [ONBOARDING_STAGE.PUBLISHED]: 'label.published',
  [ONBOARDING_STAGE.DEPRECATED]: 'label.deprecated',
};
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export const fieldValue = (values: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (value, key) => (isRecord(value) ? value[key] : undefined),
      values
    );
export const hasValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }

  return true;
};
const validLength = (value: unknown, minimum?: number) =>
  minimum === undefined ||
  (typeof value === 'string' && value.trim().length >= minimum);
const validCount = (value: unknown, minimum?: number) =>
  minimum === undefined || (Array.isArray(value) && value.length >= minimum);

/** The strings a single value answers a condition with: itself, or the ways a reference names itself. */
const comparableStrings = (item: unknown): string[] => {
  if (typeof item === 'string') {
    return [item];
  }

  return isRecord(item)
    ? [item.id, item.fullyQualifiedName, item.tagFQN, item.name].filter(
        (candidate): candidate is string => typeof candidate === 'string'
      )
    : [];
};

/**
 * Whether one member of a list answers the condition. `startsWith` is what makes "any PII tag"
 * expressible - `PII.` matches `PII.Sensitive` without the playbook listing every tag in the
 * classification - while `contains` stays an exact membership test, as it is on the server.
 */
const memberMatches = (item: unknown, target: string, operator: Operator) =>
  comparableStrings(item).some((candidate) =>
    operator === Operator.StartsWith
      ? candidate.startsWith(target)
      : candidate === target
  );

export const checkApplies = (step: OnboardingStep, values: unknown) =>
  (step.conditions ?? []).every((condition) => {
    const value = fieldValue(values, condition.fieldPath);
    if (condition.operator === Operator.Present) {
      return hasValue(value);
    }
    if (condition.operator === Operator.Equals) {
      return JSON.stringify(value) === JSON.stringify(condition.value);
    }
    const target = condition.value;
    if (typeof target !== 'string') {
      return false;
    }
    if (Array.isArray(value)) {
      return value.some((item) =>
        memberMatches(item, target, condition.operator)
      );
    }
    if (typeof value === 'string') {
      return condition.operator === Operator.StartsWith
        ? value.startsWith(target)
        : value.includes(target);
    }

    return memberMatches(value, target, condition.operator);
  });

/**
 * Checks due at a stage. The playbook's Creation gate is the intake form now, so there is nothing to
 * merge in from a separate source - a field is defined once, by the check that asks for it.
 */
export const stepsAtStage = (
  playbook: Pick<OnboardingPlaybook, 'onboarding'>,
  stage: string
): OnboardingStep[] =>
  playbook.onboarding?.gates?.find((gate) => gate.stage === stage)?.steps ?? [];
/**
 * The fields a producer must supply to create the asset, derived from the playbook's Creation gate.
 *
 * <p>A blocking check whose conditions do not apply to this asset is not required of it - that is
 * how one playbook covers a whole asset type without competing playbooks.
 */
export const getCreationIntakeFields = (
  playbook: OnboardingPlaybook | null | undefined,
  values?: unknown
): IntakeFormField[] => {
  if (!playbook?.onboarding?.enabled) {
    return [];
  }

  return stepsAtStage(playbook, ONBOARDING_STAGE.CREATION)
    .filter((step) => Boolean(step.fieldPath))
    .map((step) => ({
      fieldPath: step.fieldPath as string,
      fieldLabel: step.title ?? (step.fieldPath as string),
      fieldKind: (step.fieldPath as string).startsWith('extension.')
        ? FieldKind.CustomProperty
        : FieldKind.Native,
      required:
        step.requirement === Requirement.Blocking &&
        (values === undefined || checkApplies(step, values)),
    }));
};
export const getStepState = (
  step: OnboardingStep,
  values: unknown
): 'Complete' | 'Pending' | 'NotApplicable' => {
  if (!checkApplies(step, values)) {
    return 'NotApplicable';
  }
  if (step.type === CheckType.Approval) {
    return 'Pending';
  }
  const value = fieldValue(values, step.fieldPath ?? '');
  const valid =
    hasValue(value) &&
    validLength(value, step.rules?.minLength) &&
    validCount(value, step.rules?.minItems);

  return valid ? 'Complete' : 'Pending';
};

/**
 * Blocking creation checks the form has not satisfied yet - what keeps `Create` disabled and what
 * the footer hint names. The rules are applied here too, so a description three characters short
 * is caught before the API refuses it.
 */
export const missingCreationChecks = (
  playbook: OnboardingPlaybook | null | undefined,
  values: unknown
): OnboardingStep[] =>
  stepsAtStage(
    playbook ?? { onboarding: undefined },
    ONBOARDING_STAGE.CREATION
  ).filter(
    (step) =>
      step.requirement === Requirement.Blocking &&
      checkApplies(step, values) &&
      getStepState(step, values) !== 'Complete'
  );

/**
 * The value the producer picked that switched a conditional check on, so the create page can name
 * it: `Picking PII.Sensitive adds 1 conditional check`. The condition's own value is a prefix
 * rather than a label, so the asset's matching value reads better than the rule does.
 */
const triggerValue = (
  condition: OnboardingCondition,
  values: unknown
): string | undefined => {
  const value = fieldValue(values, condition.fieldPath);
  const candidates = Array.isArray(value) ? value : [value];
  const matched = candidates
    .flatMap(comparableStrings)
    .find(
      (candidate) =>
        typeof condition.value !== 'string' ||
        candidate.startsWith(condition.value) ||
        candidate.includes(condition.value)
    );

  return (
    matched ??
    (typeof condition.value === 'string' ? condition.value : undefined)
  );
};

export interface ConditionalTrigger {
  value: string;
  steps: OnboardingStep[];
}

/**
 * Conditional checks at a stage that the values picked so far have switched on, grouped by the
 * value that switched them on. Creating the asset is the last moment the producer can change their
 * mind cheaply, so the create page says what a choice costs before they commit to it.
 */
export const conditionalTriggers = (
  playbook: OnboardingPlaybook | null | undefined,
  stage: string,
  values: unknown
): ConditionalTrigger[] => {
  const groups = new Map<string, OnboardingStep[]>();
  stepsAtStage(playbook ?? { onboarding: undefined }, stage)
    .filter((step) => step.conditions?.length && checkApplies(step, values))
    .forEach((step) => {
      const value = (step.conditions ?? [])
        .map((condition) => triggerValue(condition, values))
        .find(Boolean);
      if (value) {
        groups.set(value, [...(groups.get(value) ?? []), step]);
      }
    });

  return [...groups.entries()].map(([value, steps]) => ({ value, steps }));
};

/** Checks queued for after creation: everything the next gate asks of this asset as it stands. */
export const applicableSteps = (
  playbook: OnboardingPlaybook | null | undefined,
  stage: string,
  values: unknown
): OnboardingStep[] =>
  stepsAtStage(playbook ?? { onboarding: undefined }, stage).filter((step) =>
    checkApplies(step, values)
  );
