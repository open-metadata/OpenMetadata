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
import type { TagLabel } from '../../generated/type/tagLabel';

const METRIC_TIER_PREFIX = 'Tier.';

export type MetricTypeBadgeColor =
  | 'blue'
  | 'gray'
  | 'indigo'
  | 'pink'
  | 'purple';

export const METRIC_TYPE_BADGE_CLASS_NAME =
  'tw:font-mono tw:uppercase tw:tracking-wide';
export const METRIC_GRANULARITY_CLASS_NAME =
  'tw:font-mono tw:uppercase tw:tracking-wide tw:text-tertiary';

export const getMetricEnumLabel = (t: TFunction, value: string) => {
  const normalizedValue = value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replaceAll('-', ' ');
  const defaultValue = normalizedValue
    .split(' ')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
  const translationKey = `label.${normalizedValue.replaceAll(' ', '-')}`;

  return t(translationKey, { defaultValue });
};

export const getMetricTypeBadgeColor = (
  metricType?: MetricType
): MetricTypeBadgeColor => {
  switch (metricType) {
    case MetricType.Ratio:
      return 'purple';
    case MetricType.Sum:
      return 'blue';
    case MetricType.Average:
      return 'indigo';
    case MetricType.Count:
      return 'pink';
    default:
      return 'gray';
  }
};

export const isMetricTierTag = (tagFqn: string) =>
  tagFqn.startsWith(METRIC_TIER_PREFIX);

export const getMetricTierTag = (tags: TagLabel[]) =>
  tags.find(({ tagFQN }) => isMetricTierTag(tagFQN));
