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
import { CustomProperty } from '../../../generated/entity/type';
import {
  FieldKind,
  IntakeForm,
  IntakeFormField,
  OnboardingGate,
  OnboardingStage,
  Type,
} from '../../../generated/governance/intakeForm';
import { CREATION_FIELDS, stepsAtStage } from './Onboarding.utils';

export const onboardingGateSummaries = (form: IntakeForm) => {
  const stages = form.onboarding?.enabled
    ? [
        OnboardingStage.Creation,
        OnboardingStage.Draft,
        OnboardingStage.InReview,
      ]
    : [OnboardingStage.Creation];

  return stages.map((stage) => {
    const steps = stepsAtStage(form, stage);
    const fixed =
      stage === OnboardingStage.Creation
        ? CREATION_FIELDS[form.entityType].filter(
            (path) => !steps.some((step) => step.fieldPath === path)
          ).length
        : 0;

    return { stage, count: steps.length + fixed };
  });
};

export const onboardingValueKind = (
  field: IntakeFormField | undefined,
  properties: CustomProperty[]
): 'text' | 'list' | 'other' => {
  if (!field) {
    return 'other';
  }
  if (field.fieldKind === FieldKind.CustomProperty) {
    const type = properties.find(
      (property) => 'extension.' + property.name === field.fieldPath
    )?.propertyType.name;
    if (['string', 'markdown', 'email'].includes(type ?? '')) {
      return 'text';
    }
    if (['entityReferenceList', 'enum'].includes(type ?? '')) {
      return 'list';
    }

    return 'other';
  }
  if (
    [
      'owners',
      'reviewers',
      'experts',
      'tags',
      'domains',
      'synonyms',
      'relatedTerms',
      'relatedMetrics',
    ].includes(field.fieldPath)
  ) {
    return 'list';
  }

  return [
    'name',
    'displayName',
    'description',
    'metricExpression.code',
  ].includes(field.fieldPath)
    ? 'text'
    : 'other';
};
export const onboardingRequiredCount = (
  gates: OnboardingGate[],
  fields: IntakeFormField[],
  stage: OnboardingStage
) =>
  gates
    .find((gate) => gate.stage === stage)
    ?.steps.filter(
      (step) =>
        step.type === Type.Approval ||
        fields.find((field) => field.fieldPath === step.fieldPath)?.required
    ).length ?? 0;

export const onboardingDueStage = (form: IntakeForm, path: string) => {
  if (!form.onboarding?.enabled) {
    return OnboardingStage.Creation;
  }

  return (
    form.onboarding.gates?.find((gate) =>
      gate.steps.some((step) => step.fieldPath === path)
    )?.stage ?? OnboardingStage.Creation
  );
};
export const onboardingRequirementLabel = (field: IntakeFormField) => {
  if (field.required) {
    return 'label.required';
  }

  return field.recommended ? 'label.recommended' : 'label.optional';
};
