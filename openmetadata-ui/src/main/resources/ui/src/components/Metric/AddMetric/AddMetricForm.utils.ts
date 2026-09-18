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
import type { CreateMetric } from '../../../generated/api/data/createMetric';
import {
  Language,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../../../generated/api/data/createMetric';
import type { EntityReference } from '../../../generated/entity/type';
import { MetricFormValues } from './AddMetricForm.interface';

const optionalProperty = <K extends string, V>(
  key: K,
  value: V | undefined
): Partial<Record<K, V>> =>
  value === undefined ? {} : ({ [key]: value } as Record<K, V>);

const nonEmptyString = (value: string) => value.trim() || undefined;

const nonEmptyArray = <T>(values: T[]) =>
  values.length > 0 ? values : undefined;

const referenceNames = (references: EntityReference[]) =>
  references.map(
    ({ fullyQualifiedName, name }) => fullyQualifiedName ?? name ?? ''
  );

const entityReferences = (
  items: MetricFormValues['owners']
): EntityReference[] => items.map((item) => item.value as EntityReference);

/**
 * Pure form-values → CreateMetric payload transform. Mirrors the legacy
 * AddMetricPage `buildCreateMetricPayload` exactly: owners/reviewers as
 * `EntityReference[]`; domains/relatedMetrics as name arrays;
 * `customUnitOfMeasurement` only when the unit is `Other`; and, when creating
 * a child metric, `metricGroup` is forced undefined and `parent` is set to the
 * parent FQN. Group creation/repointing lives in the caller — pass the already
 * resolved `metricGroup` on `values`.
 */
export const transformMetricFormData = (
  values: MetricFormValues,
  parentMetricFqn?: string
): CreateMetric => {
  const name = values.name.trim();
  const code = values.code.trim();
  const metricType = values.metricType?.value as MetricType | undefined;
  const granularity = values.granularity?.value as
    | MetricGranularity
    | undefined;
  const unitOfMeasurement = values.unitOfMeasurement?.value as
    | UnitOfMeasurement
    | undefined;
  const language = (values.language?.value as Language) ?? Language.SQL;
  const customUnit =
    unitOfMeasurement === UnitOfMeasurement.Other
      ? nonEmptyString(values.customUnitOfMeasurement)
      : undefined;
  const selectedParent = values.metricGroup?.value as
    | EntityReference
    | undefined;
  const parent =
    parentMetricFqn ??
    selectedParent?.fullyQualifiedName ??
    selectedParent?.name;

  return {
    name,
    ...optionalProperty('displayName', nonEmptyString(values.displayName)),
    ...optionalProperty('description', nonEmptyString(values.description)),
    ...optionalProperty('granularity', granularity),
    ...optionalProperty('metricType', metricType),
    ...optionalProperty('unitOfMeasurement', unitOfMeasurement),
    ...optionalProperty('customUnitOfMeasurement', customUnit),
    ...optionalProperty('parent', parent),
    ...optionalProperty(
      'owners',
      nonEmptyArray(entityReferences(values.owners))
    ),
    ...optionalProperty(
      'reviewers',
      nonEmptyArray(entityReferences(values.reviewers))
    ),
    ...optionalProperty(
      'domains',
      nonEmptyArray(referenceNames(entityReferences(values.domains)))
    ),
    ...optionalProperty(
      'relatedMetrics',
      nonEmptyArray(referenceNames(entityReferences(values.relatedMetrics)))
    ),
    metricExpression: {
      language,
      code,
    },
  };
};
