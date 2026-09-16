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
  Language,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../../../generated/api/data/createMetric';
import type { EntityReference } from '../../../generated/entity/type';
import {
  MetricFormSelectItem,
  MetricFormValues,
} from './AddMetricForm.interface';
import { transformMetricFormData } from './AddMetricForm.utils';

const reference = (
  ref: Partial<EntityReference> & { id: string }
): EntityReference => ({
  type: 'user',
  name: ref.id,
  ...ref,
});

const item = (value: EntityReference | string): MetricFormSelectItem => ({
  id: typeof value === 'string' ? value : value.id,
  value,
});

const baseValues = (
  overrides: Partial<MetricFormValues> = {}
): MetricFormValues => ({
  name: 'revenue',
  displayName: '',
  description: '',
  metricType: null,
  granularity: null,
  unitOfMeasurement: null,
  customUnitOfMeasurement: '',
  language: item(Language.SQL),
  code: 'SELECT 1',
  metricGroup: '',
  isNewMetricGroup: false,
  owners: [],
  reviewers: [],
  domains: [],
  relatedMetrics: [],
  ...overrides,
});

describe('transformMetricFormData', () => {
  it('should send owners and reviewers as EntityReference arrays', () => {
    const owner = reference({ id: 'u1', type: 'user', name: 'alice' });
    const reviewer = reference({ id: 't1', type: 'team', name: 'team-a' });

    const payload = transformMetricFormData(
      baseValues({ owners: [item(owner)], reviewers: [item(reviewer)] })
    );

    expect(payload.owners).toEqual([owner]);
    expect(payload.reviewers).toEqual([reviewer]);
  });

  it('should send domains and relatedMetrics as name arrays', () => {
    const domain = reference({
      id: 'd1',
      type: 'domain',
      name: 'sales',
      fullyQualifiedName: 'Sales.Domain',
    });
    const related = reference({
      id: 'm1',
      type: 'metric',
      name: 'cost',
      fullyQualifiedName: 'group.cost',
    });

    const payload = transformMetricFormData(
      baseValues({
        domains: [item(domain)],
        relatedMetrics: [item(related)],
      })
    );

    expect(payload.domains).toEqual(['Sales.Domain']);
    expect(payload.relatedMetrics).toEqual(['group.cost']);
  });

  it('should map enum selects to their raw value', () => {
    const payload = transformMetricFormData(
      baseValues({
        metricType: item(MetricType.Count),
        granularity: item(MetricGranularity.Day),
      })
    );

    expect(payload.metricType).toBe(MetricType.Count);
    expect(payload.granularity).toBe(MetricGranularity.Day);
  });

  it('should include customUnitOfMeasurement only when the unit is Other', () => {
    const withOther = transformMetricFormData(
      baseValues({
        unitOfMeasurement: item(UnitOfMeasurement.Other),
        customUnitOfMeasurement: 'widgets',
      })
    );

    expect(withOther.unitOfMeasurement).toBe(UnitOfMeasurement.Other);
    expect(withOther.customUnitOfMeasurement).toBe('widgets');

    const withDollars = transformMetricFormData(
      baseValues({
        unitOfMeasurement: item(UnitOfMeasurement.Dollars),
        customUnitOfMeasurement: 'widgets',
      })
    );

    expect(withDollars.customUnitOfMeasurement).toBeUndefined();
  });

  it('should force metricGroup undefined and set parent when a parent FQN is given', () => {
    const payload = transformMetricFormData(
      baseValues({ metricGroup: 'ignored-group' }),
      'parent.metric.fqn'
    );

    expect(payload.metricGroup).toBeUndefined();
    expect(payload.parent).toBe('parent.metric.fqn');
  });

  it('should keep metricGroup when there is no parent', () => {
    const payload = transformMetricFormData(
      baseValues({ metricGroup: 'growth' })
    );

    expect(payload.metricGroup).toBe('growth');
    expect(payload.parent).toBeUndefined();
  });

  it('should build the metric expression from language and trimmed code', () => {
    const payload = transformMetricFormData(
      baseValues({ language: item(Language.Java), code: '  return 1;  ' })
    );

    expect(payload.metricExpression).toEqual({
      language: Language.Java,
      code: 'return 1;',
    });
  });
});
