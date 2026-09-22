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
  Assistance,
  CheckType,
  OnboardingCondition,
  OnboardingStageDefinition,
  OnboardingStep,
  Operator,
  Requirement,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { CustomProperty } from '../../../generated/entity/type';
import { STAGE_LABELS } from './Onboarding.utils';

/**
 * Shape of the value a check captures. It decides which label the builder shows and, later, which
 * editor the producer is given - a field's JSON type alone cannot tell a tag list from a user list.
 */
export type FieldDtype =
  | 'string'
  | 'markdown'
  | 'enum'
  | 'table'
  | 'tag[]'
  | 'entityRef'
  | 'termRef[]'
  | 'user[]'
  | 'sqlQuery'
  | 'automated'
  | 'workflow'
  | 'number'
  | 'date';

/** Native fields whose shape is not `Text`. Anything unlisted reads as plain text. */
export const NATIVE_DTYPE: Record<string, FieldDtype> = {
  assets: 'entityRef',
  attributes: 'table',
  certification: 'tag[]',
  childrenCount: 'number',
  conceptType: 'enum',
  consumesFrom: 'entityRef',
  dataContract: 'entityRef',
  dataProductType: 'enum',
  dataProducts: 'entityRef',
  derivedFrom: 'entityRef',
  description: 'markdown',
  dimensions: 'table',
  domainType: 'enum',
  domains: 'entityRef',
  experts: 'user[]',
  filters: 'table',
  glossary: 'entityRef',
  glossaryTerms: 'termRef[]',
  granularity: 'enum',
  lifecycleStage: 'enum',
  measures: 'table',
  metricExpression: 'sqlQuery',
  metricType: 'enum',
  owners: 'user[]',
  parent: 'entityRef',
  portfolioPriority: 'enum',
  realizedIn: 'entityRef',
  relatedMetrics: 'entityRef',
  relatedTerms: 'termRef[]',
  providesTo: 'entityRef',
  reviewers: 'user[]',
  service: 'entityRef',
  tags: 'tag[]',
  unitOfMeasurement: 'enum',
  usageCount: 'number',
  visibility: 'enum',
};

/** Custom-property types, keyed by `propertyType.name` as the metadata type API reports them. */
export const CUSTOM_DTYPE: Record<string, FieldDtype> = {
  date: 'date',
  'date-cp': 'date',
  'dateTime-cp': 'date',
  duration: 'string',
  email: 'string',
  enum: 'enum',
  integer: 'number',
  markdown: 'markdown',
  number: 'number',
  sqlQuery: 'sqlQuery',
  string: 'string',
  table: 'table',
  'time-cp': 'date',
  timestamp: 'number',
};

export const DTYPE_LABEL_KEY: Record<FieldDtype, string> = {
  automated: 'label.automated-check',
  date: 'label.date',
  entityRef: 'label.asset-reference',
  enum: 'label.single-select',
  markdown: 'label.markdown',
  number: 'label.number',
  sqlQuery: 'label.sql-query',
  string: 'label.text',
  table: 'label.table',
  'tag[]': 'label.tag-plural',
  'termRef[]': 'label.glossary-term-plural',
  'user[]': 'label.user-plural',
  workflow: 'label.workflow',
};

/**
 * The shape of the value a check asks for.
 *
 * <p>An approval is a decision rather than a field, and an assessment is something the platform
 * runs, so both answer by check type before the field path is consulted.
 */
export const dtypeOf = (
  step: Pick<OnboardingStep, 'type' | 'fieldPath'>,
  properties: CustomProperty[] = []
): FieldDtype => {
  if (step.type === CheckType.Approval) {
    return 'workflow';
  }
  if (step.type === CheckType.Assessment) {
    return 'automated';
  }
  const path = step.fieldPath ?? '';
  if (path.startsWith('extension.')) {
    const property = properties.find(
      (candidate) => candidate.name === path.slice('extension.'.length)
    );

    return CUSTOM_DTYPE[property?.propertyType?.name ?? ''] ?? 'string';
  }

  return NATIVE_DTYPE[path] ?? 'string';
};

/** Minutes the gate asks of the person completing it: assisted checks are quicker than blank ones. */
export const estimateMinutes = (steps: OnboardingStep[]): number =>
  steps.reduce(
    (total, step) =>
      total +
      ((step.assistance ?? Assistance.None) === Assistance.None ? 3 : 1),
    0
  );

export interface RuleDescription {
  key: string;
  count?: number;
}

/**
 * What counts as a filled-in answer, in the words the wizard repeats back to the producer. Derived
 * rather than authored so the builder and the wizard can never disagree about it.
 */
export const describeRule = (step: OnboardingStep): RuleDescription => {
  if (step.type === CheckType.Approval) {
    return { key: 'message.accepted-when-decision-recorded' };
  }
  if (step.rules?.minLength) {
    return {
      key: 'message.accepted-when-min-length',
      count: step.rules.minLength,
    };
  }
  if (step.rules?.minItems) {
    return {
      key: 'message.accepted-when-min-items',
      count: step.rules.minItems,
    };
  }

  return { key: 'message.accepted-when-not-empty' };
};

const CONDITION_KEY: Record<Operator, string> = {
  [Operator.Contains]: 'message.condition-contains',
  [Operator.Equals]: 'message.condition-equals',
  [Operator.Present]: 'message.condition-present',
  [Operator.StartsWith]: 'message.condition-starts-with',
};

export interface ConditionDescription {
  key: string;
  field: string;
  value: string;
}

/** `tags startsWith PII.` as a sentence the check row can show as `Only when: …`. */
export const describeCondition = (
  condition: OnboardingCondition
): ConditionDescription => ({
  key: CONDITION_KEY[condition.operator] ?? CONDITION_KEY[Operator.Present],
  field: condition.fieldPath,
  value: typeof condition.value === 'string' ? condition.value : '',
});

/** The coarsest unit that still has a whole number in it, so `6d` never reads as `144h`. */
const coarsestUnit = (minutes: number): [number, 'day' | 'hour' | 'minute'] => {
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days) {
    return [days, 'day'];
  }

  return hours ? [hours, 'hour'] : [minutes, 'minute'];
};

/**
 * Age in the narrow units the design uses - `just now`, `4h`, `6d`. The caller supplies the
 * translated `just now`, keeping the arithmetic locale-independent and testable.
 */
export const formatAge = (
  timestamp: number | undefined,
  locale: string,
  justNowLabel: string,
  now: number = Date.now()
): string | undefined => {
  if (!timestamp) {
    return undefined;
  }
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes === 0) {
    return justNowLabel;
  }
  const [value, unit] = coarsestUnit(minutes);

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'narrow',
  }).format(value);
};

/**
 * The name a stage goes by. A playbook-declared stage supplies its own label; the default
 * lifecycle falls back to the shared translations, and an unknown key shows as itself.
 */
export const stageLabel = (
  stageKey: string,
  translate: (key: string) => string,
  stages: OnboardingStageDefinition[] = []
): string => {
  const declared = stages.find((stage) => stage.key === stageKey);
  if (declared?.displayName) {
    return declared.displayName;
  }

  return STAGE_LABELS[stageKey] ? translate(STAGE_LABELS[stageKey]) : stageKey;
};

/** How hard a check pushes, in the builder's and the create page's words. */
export const requirementLabelKey = (requirement?: Requirement): string => {
  if (requirement === Requirement.Blocking) {
    return 'label.blocking';
  }

  return requirement === Requirement.Recommended
    ? 'label.recommended'
    : 'label.optional';
};
