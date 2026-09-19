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
import { fieldValue, hasValue, isRecord } from './Onboarding.utils';

/** At least two siblings must agree before a value counts as the domain's convention. */
export const MIN_AGREEMENT = 2;

interface Normalized {
  key: string;
  label: string;
  value: unknown;
}

const referenceLabel = (item: unknown): string => {
  if (typeof item === 'string') {
    return item;
  }
  if (!isRecord(item)) {
    return '';
  }
  const candidate =
    item.displayName ?? item.name ?? item.fullyQualifiedName ?? item.tagFQN;

  return typeof candidate === 'string' ? candidate : '';
};

const referenceKey = (item: unknown): string => {
  if (typeof item === 'string') {
    return item;
  }
  if (!isRecord(item)) {
    return '';
  }
  const candidate = item.fullyQualifiedName ?? item.tagFQN ?? item.id;

  return typeof candidate === 'string' ? candidate : '';
};

/**
 * One asset's answer to a field, reduced to something countable and something readable. Two
 * siblings that name the same owner in a different order still answer the same way, so the key is
 * order-independent.
 */
const normalize = (value: unknown): Normalized | undefined => {
  if (!hasValue(value)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const keys = value.map(referenceKey).filter(Boolean);

    return keys.length
      ? {
          key: [...keys].sort().join('|'),
          label: value.map(referenceLabel).filter(Boolean).join(', '),
          value,
        }
      : undefined;
  }
  if (typeof value === 'string') {
    return { key: value, label: value, value };
  }
  const key = referenceKey(value);

  return key ? { key, label: referenceLabel(value), value } : undefined;
};

/**
 * The value this field most often carries across the sampled siblings, or nothing when they do not
 * agree. Assistance is a shortcut to a convention; without a convention there is nothing to offer.
 */
export const mostCommonFieldValue = (
  sources: unknown[],
  fieldPath: string
):
  | { label: string; value: unknown; count: number; total: number }
  | undefined => {
  const counts = new Map<string, { entry: Normalized; count: number }>();
  sources.forEach((source) => {
    const normalized = normalize(fieldValue(source, fieldPath));
    if (normalized) {
      const existing = counts.get(normalized.key);
      counts.set(normalized.key, {
        entry: normalized,
        count: (existing?.count ?? 0) + 1,
      });
    }
  });
  const best = [...counts.values()].sort((a, b) => b.count - a.count)[0];

  return best && best.count >= MIN_AGREEMENT
    ? {
        count: best.count,
        label: best.entry.label,
        total: sources.length,
        value: best.entry.value,
      }
    : undefined;
};
