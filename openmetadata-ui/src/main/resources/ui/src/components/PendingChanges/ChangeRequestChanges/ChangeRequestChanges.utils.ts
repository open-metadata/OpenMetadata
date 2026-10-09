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
import { isEqual } from 'lodash';
import {
  MutationOp,
  MutationOpType,
} from '../../../generated/governance/changeRequest/changeRequest';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  getClassificationTagPath,
  getGlossaryTermDetailsPath,
} from '../../../utils/RouterUtils';

export enum ChangeKind {
  Added = 'added',
  Removed = 'removed',
  Updated = 'updated',
}

export interface ChangeValue {
  text: string;
  link?: string;
}

/** One field's change: what it holds now, and for an update what it held before. */
export interface ChangeEntry {
  field: string;
  kind: ChangeKind;
  values: ChangeValue[];
  previous: ChangeValue[];
}

/** The changes to the asset itself, or to one of its columns when `column` is set. */
export interface ChangeSection {
  column?: string;
  entries: ChangeEntry[];
}

interface Column {
  name: string;
  children?: Column[];
  [field: string]: unknown;
}

const MAX_TEXT_LENGTH = 120;
const COLUMNS_FIELD = 'columns';
const TAGS_FIELD = 'tags';
const GLOSSARY_SOURCE = 'Glossary';
// Column attributes a reviewer reads; tags are compared by FQN separately.
const COLUMN_FIELDS = [
  'displayName',
  'description',
  'dataTypeDisplay',
  'constraint',
];

const truncate = (text: string): string =>
  text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text;

const plainText = (text: string): string =>
  truncate(
    text
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

// Tags and glossary terms read by their FQN and open their page; an entity reference reads by its
// fully qualified name and opens the entity when its type has a details page.
export const toValue = (value: unknown): ChangeValue => {
  if (!isRecord(value)) {
    return { text: plainText(String(value)) };
  }
  const tagFqn = stringOf(value.tagFQN);
  if (tagFqn) {
    return {
      text: tagFqn,
      link:
        value.source === GLOSSARY_SOURCE
          ? getGlossaryTermDetailsPath(tagFqn)
          : getClassificationTagPath(tagFqn),
    };
  }
  const fqn = stringOf(value.fullyQualifiedName) ?? stringOf(value.name);
  const type = stringOf(value.type);
  if (fqn) {
    return {
      text: fqn,
      link: type
        ? entityUtilClassBase.getEntityLink(type, fqn) || undefined
        : undefined,
    };
  }

  return { text: truncate(JSON.stringify(value)) };
};

const toValues = (value: unknown): ChangeValue[] => {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  return Array.isArray(value) ? value.map(toValue) : [toValue(value)];
};

// Op values are stored as JSON text.
const parse = (json?: string): unknown => (json ? JSON.parse(json) : undefined);

const entry = (
  field: string,
  kind: ChangeKind,
  values: ChangeValue[],
  previous: ChangeValue[] = []
): ChangeEntry => ({ field, kind, values, previous });

const minus = (source: ChangeValue[], other: ChangeValue[]): ChangeValue[] =>
  source.filter((value) => !other.some((o) => o.text === value.text));

// A list replaced in one op is shown as what it gained and what it lost.
const listEntries = (
  field: string,
  before: ChangeValue[],
  after: ChangeValue[]
): ChangeEntry[] =>
  [
    entry(field, ChangeKind.Added, minus(after, before)),
    entry(field, ChangeKind.Removed, minus(before, after)),
  ].filter((change) => change.values.length > 0);

const setEntries = (
  field: string,
  before: unknown,
  after: unknown
): ChangeEntry[] => {
  const previous = toValues(before);
  const values = toValues(after);
  let entries: ChangeEntry[];
  if (Array.isArray(before) || Array.isArray(after)) {
    entries = listEntries(field, previous, values);
  } else if (previous.length === 0) {
    entries = values.length ? [entry(field, ChangeKind.Added, values)] : [];
  } else if (values.length === 0) {
    entries = [entry(field, ChangeKind.Removed, previous)];
  } else {
    entries = [entry(field, ChangeKind.Updated, values, previous)];
  }

  return entries;
};

const columnChanges = (before: Column, after: Column): ChangeEntry[] => [
  ...COLUMN_FIELDS.filter(
    (field) => !isEqual(before[field], after[field])
  ).flatMap((field) => setEntries(field, before[field], after[field])),
  ...listEntries(TAGS_FIELD, toValues(before.tags), toValues(after.tags)),
];

const byName = (columns: Column[] = []) =>
  new Map(columns.map((column) => [column.name, column]));

// Columns are matched by name; nested columns are named by their path, e.g. `address.city`.
const columnSections = (
  before: Column[] = [],
  after: Column[] = [],
  path = ''
): ChangeSection[] => {
  const previous = byName(before);
  const next = byName(after);
  const named = (name: string) => (path ? `${path}.${name}` : name);
  const added = after.filter((column) => !previous.has(column.name));
  const removed = before.filter((column) => !next.has(column.name));
  const membership = [
    entry(
      COLUMNS_FIELD,
      ChangeKind.Added,
      added.map((c) => ({ text: named(c.name) }))
    ),
    entry(
      COLUMNS_FIELD,
      ChangeKind.Removed,
      removed.map((c) => ({ text: named(c.name) }))
    ),
  ].filter((change) => change.values.length > 0);

  const changed = after
    .filter((column) => previous.has(column.name))
    .flatMap((column) => {
      const old = previous.get(column.name) as Column;
      const entries = columnChanges(old, column);
      const own: ChangeSection[] = entries.length
        ? [{ column: named(column.name), entries }]
        : [];

      return [
        ...own,
        ...columnSections(old.children, column.children, named(column.name)),
      ];
    });

  return [...(membership.length ? [{ entries: membership }] : []), ...changed];
};

const opEntries = (op: MutationOp): ChangeEntry[] => {
  const value = toValues(parse(op.value));
  const kinds: Record<MutationOpType, () => ChangeEntry[]> = {
    [MutationOpType.Add]: () => [entry(op.field, ChangeKind.Added, value)],
    [MutationOpType.Remove]: () => [entry(op.field, ChangeKind.Removed, value)],
    [MutationOpType.Set]: () =>
      setEntries(op.field, parse(op.baseValue), parse(op.value)),
  };

  return kinds[op.op]();
};

// Adds and removes on the same field and kind read as one row, e.g. `Tags · Added A, B`.
const mergeByFieldAndKind = (entries: ChangeEntry[]): ChangeEntry[] =>
  entries.reduce<ChangeEntry[]>((merged, change) => {
    const same = merged.find(
      (m) =>
        m.field === change.field && m.kind === change.kind && !m.previous.length
    );
    if (same && !change.previous.length) {
      same.values.push(...change.values);
    } else {
      merged.push({ ...change, values: [...change.values] });
    }

    return merged;
  }, []);

/**
 * Turns a change request's ops into what a reviewer reads: the asset's own field changes first,
 * then one section per changed column. A column list replaced in one op is compared column by
 * column, so only the columns that actually changed appear.
 */
export const buildChangeSections = (
  ops: MutationOp[] = []
): ChangeSection[] => {
  const columnOps = ops.filter(
    (op) => op.field === COLUMNS_FIELD && op.op === MutationOpType.Set
  );
  const assetEntries = mergeByFieldAndKind(
    ops.filter((op) => !columnOps.includes(op)).flatMap(opEntries)
  );
  const columns = columnOps.flatMap((op) =>
    columnSections(
      parse(op.baseValue) as Column[] | undefined,
      parse(op.value) as Column[] | undefined
    )
  );
  const membership = columns.filter((section) => !section.column);
  const asset = [
    ...assetEntries,
    ...membership.flatMap((section) => section.entries),
  ];

  return [
    ...(asset.length ? [{ entries: asset }] : []),
    ...columns.filter((section) => section.column),
  ];
};
