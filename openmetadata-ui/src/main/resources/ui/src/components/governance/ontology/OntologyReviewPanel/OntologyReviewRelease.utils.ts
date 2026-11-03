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

export interface FieldChange {
  field: string;
  before?: string;
  after?: string;
}

// Bookkeeping the server rewrites on every save: it differs between any two
// snapshots and says nothing about what the author changed.
const IGNORED_FIELDS = new Set([
  'updatedAt',
  'updatedBy',
  'version',
  'href',
  'changeDescription',
  'incrementalChangeDescription',
]);

const LABEL_KEYS = [
  'displayName',
  'name',
  'label',
  'iri',
  'fullyQualifiedName',
];

/**
 * `key` is what two snapshots are compared by, so it holds every structured
 * value. `text` is what the reader sees. `detailed` adds identities, and is
 * shown only when two different values would otherwise read the same.
 */
interface Leaf {
  key: string;
  text: string;
  detailed: string;
}

type Leaves = Map<string, Leaf>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const withoutBookkeeping = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(withoutBookkeeping);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !IGNORED_FIELDS.has(key))
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, child]) => [key, withoutBookkeeping(child)])
    );
  }

  return value;
};

const itemLabel = (item: unknown): string | undefined => {
  if (!isRecord(item)) {
    return item === null || item === undefined ? undefined : String(item);
  }
  const key = LABEL_KEYS.find(
    (candidate) => typeof item[candidate] === 'string'
  );

  return key ? String(item[key]) : undefined;
};

// A label that holds the separator is quoted so ['a, b'] never reads as ['a', 'b'].
const listText = (labels: string[]) =>
  labels
    .map((label) => (label.includes(', ') ? JSON.stringify(label) : label))
    .join(', ');

const itemDetail = (item: unknown, label: string) => {
  if (!isRecord(item)) {
    return label;
  }
  const identity =
    typeof item.id === 'string'
      ? item.id
      : JSON.stringify(withoutBookkeeping(item));

  return `${label} (${identity})`;
};

const collect = (value: unknown, path: string, leaves: Leaves) => {
  if (value === null || value === undefined || value === '') {
    return;
  }
  if (Array.isArray(value)) {
    const labels = value.map(itemLabel);
    if (labels.every((label): label is string => label !== undefined)) {
      if (labels.length) {
        leaves.set(path, {
          key: JSON.stringify(withoutBookkeeping(value)),
          text: listText(labels),
          detailed: listText(
            labels.map((label, index) => itemDetail(value[index], label))
          ),
        });
      }

      return;
    }
    value.forEach((item, index) =>
      collect(item, `${path}[${index + 1}]`, leaves)
    );

    return;
  }
  if (isRecord(value)) {
    Object.entries(value)
      .filter(([key]) => !IGNORED_FIELDS.has(key))
      .forEach(([key, child]) => collect(child, `${path}.${key}`, leaves));

    return;
  }
  const text = String(value);
  leaves.set(path, { key: `${typeof value}:${text}`, text, detailed: text });
};

const flatten = (payload: unknown): Leaves => {
  const leaves: Leaves = new Map();
  if (isRecord(payload)) {
    Object.entries(payload)
      .filter(([key]) => !IGNORED_FIELDS.has(key))
      .forEach(([key, child]) => collect(child, key, leaves));
  }

  return leaves;
};

/**
 * One row per field whose value differs between the two snapshots, with the
 * old and new value as text. A field only one side has reads as unset on the
 * other, which is how an added or removed member lists every field.
 */
export const diffMemberFields = (
  before: unknown,
  after: unknown
): FieldChange[] => {
  const previous = flatten(before);
  const next = flatten(after);

  return [...new Set([...previous.keys(), ...next.keys()])]
    .filter((field) => previous.get(field)?.key !== next.get(field)?.key)
    .map((field) => {
      const old = previous.get(field);
      const current = next.get(field);
      const needsIdentity = old?.text === current?.text;

      return {
        field,
        before: needsIdentity ? old?.detailed : old?.text,
        after: needsIdentity ? current?.detailed : current?.text,
      };
    });
};
