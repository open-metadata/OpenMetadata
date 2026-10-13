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
import { diffWords } from 'diff';
import { TFunction } from 'i18next';
import {
  MEMORY_TYPE_OPTIONS,
  VISIBILITY_OPTIONS,
} from '../../../../constants/ContextCenter.constants';
import {
  ContextMemory,
  EntityReference,
} from '../../../../generated/entity/context/contextMemory';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { MemoryConflictReviewDispute } from '../MemoryConflictReviews/MemoryConflictReviews.types';
import { getClaimUpdatedAt } from '../MemoryConflictReviews/MemoryConflictReviews.utils';
import {
  MEMORY_SOURCE_LABEL_KEYS,
  UNAVAILABLE_BY_STATUS,
  UNAVAILABLE_MEMORY_LABEL_KEYS,
} from './MemoryConflictCompare.constants';
import {
  DiffSides,
  KeepHint,
  ListValue,
  MemoryDiffRow,
  UnavailableMemory,
} from './MemoryConflictCompare.types';

/**
 * Word-level diff: what the current text drops and the proposed one adds.
 * Each side is diffed against the other so it keeps its own words and
 * spacing: a diff takes the words both share from its second text.
 */
export const diffText = (current = '', proposed = ''): DiffSides => {
  const forward = diffWords(current, proposed);
  const backward = diffWords(proposed, current);

  return {
    current: backward
      .filter((part) => !part.removed)
      .map((part, index) => ({
        id: `current-${index}`,
        value: part.value,
        change: part.added ? 'removed' : undefined,
      })),
    proposed: forward
      .filter((part) => !part.removed)
      .map((part, index) => ({
        id: `proposed-${index}`,
        value: part.value,
        change: part.added ? 'added' : undefined,
      })),
    isChanged: forward.some((part) => part.added || part.removed),
  };
};

/** Values only one side holds are what that side removes or adds. */
export const diffList = (
  current: ListValue[],
  proposed: ListValue[]
): DiffSides => {
  const inCurrent = new Set(current.map(({ key }) => key));
  const inProposed = new Set(proposed.map(({ key }) => key));

  return {
    current: current.map(({ key, label }, index) => ({
      id: `current-${index}`,
      value: label,
      change: inProposed.has(key) ? undefined : 'removed',
    })),
    proposed: proposed.map(({ key, label }, index) => ({
      id: `proposed-${index}`,
      value: label,
      change: inCurrent.has(key) ? undefined : 'added',
    })),
    isChanged:
      current.some(({ key }) => !inProposed.has(key)) ||
      proposed.some(({ key }) => !inCurrent.has(key)),
  };
};

/** Both sides as they are, nothing marked: there is no other side to compare. */
const unmarked = (sides: DiffSides): DiffSides => ({
  current: sides.current.map(({ id, value }) => ({ id, value })),
  proposed: sides.proposed.map(({ id, value }) => ({ id, value })),
  isChanged: false,
});

const referenceValues = (references: EntityReference[] = []): ListValue[] =>
  references.map((reference) => ({
    key: reference.fullyQualifiedName ?? reference.id,
    label: getEntityName(reference),
  }));

const linkedAssets = (memory?: ContextMemory): ListValue[] =>
  referenceValues(
    [memory?.primaryEntity, ...(memory?.relatedEntities ?? [])].filter(
      (asset): asset is EntityReference => Boolean(asset)
    )
  );

const tags = (memory?: ContextMemory): ListValue[] =>
  (memory?.tags ?? []).map((tag) => ({
    key: tag.tagFQN,
    label: tag.displayName || tag.name || tag.tagFQN,
  }));

const labelled = (
  value: string | undefined,
  labelKey: string | undefined,
  t: TFunction
): ListValue[] =>
  value ? [{ key: value, label: labelKey ? t(labelKey) : value }] : [];

const memoryType = (memory: ContextMemory | undefined, t: TFunction) =>
  labelled(
    memory?.memoryType,
    MEMORY_TYPE_OPTIONS.find(({ id }) => id === memory?.memoryType)?.labelKey,
    t
  );

const visibility = (memory: ContextMemory | undefined, t: TFunction) =>
  labelled(
    memory?.shareConfig?.visibility,
    VISIBILITY_OPTIONS.find(({ id }) => id === memory?.shareConfig?.visibility)
      ?.labelKey,
    t
  );

const source = (memory: ContextMemory | undefined, t: TFunction) =>
  memory?.sourceEntity
    ? referenceValues([memory.sourceEntity])
    : labelled(
        memory?.sourceType,
        memory?.sourceType && MEMORY_SOURCE_LABEL_KEYS[memory.sourceType],
        t
      );

/**
 * Every field a memory's detail view shows, current memory against the one in
 * review: text fields diff word by word, the rest value by value. While a side
 * is missing nothing is marked, since a diff against nothing would mark it all.
 */
export const getMemoryDiffRows = (
  current: ContextMemory | undefined,
  proposed: ContextMemory | undefined,
  t: TFunction
): MemoryDiffRow[] => {
  const rows: MemoryDiffRow[] = [
    {
      key: 'title',
      labelKey: 'label.title',
      kind: 'text',
      sides: diffText(current?.title, proposed?.title),
    },
    {
      key: 'memory',
      labelKey: 'label.memory',
      kind: 'text',
      sides: diffText(current?.answer, proposed?.answer),
    },
    {
      key: 'question',
      labelKey: 'label.question',
      kind: 'text',
      sides: diffText(current?.question, proposed?.question),
    },
    {
      key: 'type',
      labelKey: 'label.type',
      kind: 'list',
      sides: diffList(memoryType(current, t), memoryType(proposed, t)),
    },
    {
      key: 'linked-assets',
      labelKey: 'label.linked-data-asset-plural',
      kind: 'list',
      sides: diffList(linkedAssets(current), linkedAssets(proposed)),
    },
    {
      key: 'visibility',
      labelKey: 'label.visibility',
      kind: 'list',
      sides: diffList(visibility(current, t), visibility(proposed, t)),
    },
    {
      key: 'tags',
      labelKey: 'label.tag-plural',
      kind: 'list',
      sides: diffList(tags(current), tags(proposed)),
    },
    {
      key: 'source',
      labelKey: 'label.source',
      kind: 'list',
      sides: diffList(source(current, t), source(proposed, t)),
    },
    {
      key: 'owners',
      labelKey: 'label.owner-plural',
      kind: 'list',
      sides: diffList(
        referenceValues(current?.owners),
        referenceValues(proposed?.owners)
      ),
    },
  ];

  return current && proposed
    ? rows
    : rows.map((row) => ({ ...row, sides: unmarked(row.sides) }));
};

/** Who owns the memory and when its claim last changed, as one line. */
export const getMemoryByline = (memory?: ContextMemory): string => {
  const claimUpdatedAt = getClaimUpdatedAt(memory);

  return [
    memory?.owners?.[0] && getEntityName(memory.owners[0]),
    claimUpdatedAt && formatDate(claimUpdatedAt),
  ]
    .filter(Boolean)
    .join(' · ');
};

/** A memory read failed: gone, not readable by this user, or not loaded. */
export const getUnavailableMemory = (
  error: unknown
): UnavailableMemory | undefined => {
  const status = (error as { response?: { status?: number } } | null)?.response
    ?.status;

  return error ? UNAVAILABLE_BY_STATUS[status ?? 0] ?? 'failed' : undefined;
};

export const getUnavailableMemoryLabel = (
  unavailable: UnavailableMemory,
  t: TFunction
): string =>
  t(UNAVAILABLE_MEMORY_LABEL_KEYS[unavailable], {
    entity: t('label.memory'),
  });

/** What keeping each side does to the other, as translation keys. */
export const getKeepHints = (
  disputes: MemoryConflictReviewDispute[],
  reviewedTitle: string,
  disputedTitle: string
): { approved: KeepHint; reviewed: KeepHint } =>
  disputes.length === 1
    ? {
        approved: {
          key: 'message.keep-approved-memory-hint',
          options: { title: reviewedTitle },
        },
        reviewed: {
          key: 'message.keep-reviewed-memory-hint',
          options: { title: disputedTitle },
        },
      }
    : {
        approved: {
          key: 'message.keep-approved-memories-hint',
          options: { title: reviewedTitle },
        },
        reviewed: {
          key: 'message.keep-reviewed-memory-hint-plural',
          options: { count: disputes.length },
        },
      };
