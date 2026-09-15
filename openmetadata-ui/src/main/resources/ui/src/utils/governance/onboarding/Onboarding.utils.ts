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
  IntakeForm,
  IntakeFormField,
  OnboardingStage,
  OnboardingStep,
  Operator,
  TargetEntityType,
  Type,
} from '../../../generated/governance/intakeForm';
import { getIntakeFormFields } from '../../IntakeFormUtils';

export const ONBOARDING_STAGES = [
  OnboardingStage.Creation,
  OnboardingStage.Draft,
  OnboardingStage.InReview,
  OnboardingStage.Approved,
  OnboardingStage.Deprecated,
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
export const STAGE_LABELS: Record<OnboardingStage, string> = {
  [OnboardingStage.Creation]: 'label.creation',
  [OnboardingStage.Draft]: 'label.draft',
  [OnboardingStage.InReview]: 'label.in-review',
  [OnboardingStage.Approved]: 'label.approved',
  [OnboardingStage.Deprecated]: 'label.deprecated',
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

export const checkApplies = (step: OnboardingStep, values: unknown) =>
  (step.conditions ?? []).every((condition) => {
    const value = fieldValue(values, condition.fieldPath);
    if (condition.operator === Operator.Present) {
      return hasValue(value);
    }
    if (condition.operator === Operator.Equals) {
      return JSON.stringify(value) === JSON.stringify(condition.value);
    }
    if (typeof value === 'string' && typeof condition.value === 'string') {
      return value.includes(condition.value);
    }

    return (
      Array.isArray(value) &&
      value.some(
        (item) =>
          item === condition.value ||
          (isRecord(item) &&
            [item.id, item.fullyQualifiedName, item.tagFQN].includes(
              condition.value
            ))
      )
    );
  });
export const stepsAtStage = (
  form: Pick<IntakeForm, 'onboarding' | 'formFields' | 'requiredFields'>,
  stage: OnboardingStage
): OnboardingStep[] => {
  const steps =
    form.onboarding?.gates?.find((gate) => gate.stage === stage)?.steps ?? [];
  if (stage !== OnboardingStage.Creation) {
    return steps;
  }
  const scheduled = new Set(
    form.onboarding?.gates?.flatMap((gate) =>
      gate.steps.map((step) => step.fieldPath)
    )
  );

  return [
    ...steps,
    ...getIntakeFormFields(form)
      .filter((field) => !scheduled.has(field.fieldPath))
      .map((field) => ({
        id: `field_${field.fieldPath.replaceAll('.', '_')}`,
        type: Type.Field,
        fieldPath: field.fieldPath,
        title: field.fieldLabel,
      })),
  ];
};
export const getCreationIntakeFields = (
  form: IntakeForm | null | undefined,
  values?: unknown
): IntakeFormField[] => {
  const fields = getIntakeFormFields(form);
  if (!form?.onboarding?.enabled) {
    return fields;
  }
  const steps = stepsAtStage(form, OnboardingStage.Creation);

  return fields.map((field) => {
    const step = steps.find(
      (candidate) => candidate.fieldPath === field.fieldPath
    );

    return {
      ...field,
      required: Boolean(
        field.required &&
          step &&
          (values === undefined || checkApplies(step, values))
      ),
    };
  });
};
export const getStepState = (
  step: OnboardingStep,
  values: unknown
): 'Complete' | 'Pending' | 'NotApplicable' => {
  if (!checkApplies(step, values)) {
    return 'NotApplicable';
  }
  if (step.type === Type.Approval) {
    return 'Pending';
  }
  const value = fieldValue(values, step.fieldPath ?? '');
  const valid =
    hasValue(value) &&
    validLength(value, step.rules?.minLength) &&
    validCount(value, step.rules?.minItems);

  return valid ? 'Complete' : 'Pending';
};
