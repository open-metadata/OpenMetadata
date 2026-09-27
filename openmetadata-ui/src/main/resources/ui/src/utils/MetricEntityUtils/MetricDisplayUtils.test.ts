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
import type { TFunction } from 'i18next';
import { MetricType } from '../../generated/entity/data/metric';
import { LabelType, State, TagSource } from '../../generated/type/tagLabel';
import {
  getMetricEnumLabel,
  getMetricTierTag,
  getMetricTypeBadgeColor,
  isMetricTierTag,
  METRIC_GRANULARITY_CLASS_NAME,
  METRIC_TYPE_BADGE_CLASS_NAME,
} from './MetricDisplayUtils';

describe('MetricDisplayUtils', () => {
  const t = ((key: string) => key) as TFunction;
  const tag = (tagFQN: string, name?: string) => ({
    labelType: LabelType.Manual,
    name,
    source: TagSource.Classification,
    state: State.Confirmed,
    tagFQN,
  });

  it('converts schema enum values to localized label keys', () => {
    expect(getMetricEnumLabel(t, 'STANDARD_DEVIATION')).toBe(
      'label.standard-deviation'
    );
    expect(getMetricEnumLabel(t, 'In Review')).toBe('label.in-review');
  });

  it('uses a readable label when a locale does not define the enum value', () => {
    const fallbackT = ((_key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue) as TFunction;

    expect(getMetricEnumLabel(fallbackT, 'STANDARD_DEVIATION')).toBe(
      'Standard Deviation'
    );
    expect(getMetricEnumLabel(fallbackT, 'DOLLARS')).toBe('Dollars');
  });

  it.each([
    [MetricType.Ratio, 'purple'],
    [MetricType.Sum, 'blue'],
    [MetricType.Average, 'indigo'],
    [MetricType.Count, 'pink'],
    [MetricType.Percentage, 'gray'],
    [undefined, 'gray'],
  ] as const)(
    'maps %s metrics to the %s badge palette',
    (metricType, color) => {
      expect(getMetricTypeBadgeColor(metricType)).toBe(color);
    }
  );

  it('exposes the shared compact uppercase metadata typography', () => {
    expect(METRIC_TYPE_BADGE_CLASS_NAME).toContain('tw:font-mono');
    expect(METRIC_TYPE_BADGE_CLASS_NAME).toContain('tw:uppercase');
    expect(METRIC_GRANULARITY_CLASS_NAME).toContain('tw:font-mono');
    expect(METRIC_GRANULARITY_CLASS_NAME).toContain('tw:uppercase');
  });

  it('identifies only Tier classification tags', () => {
    expect(isMetricTierTag('Tier.Tier1')).toBe(true);
    expect(isMetricTierTag('Certification.Gold')).toBe(false);
  });

  it('returns the first tier without importing broad table utilities', () => {
    expect(
      getMetricTierTag([tag('PII.Sensitive'), tag('Tier.Tier2', 'Tier 2')])
    ).toEqual(tag('Tier.Tier2', 'Tier 2'));
  });
});
