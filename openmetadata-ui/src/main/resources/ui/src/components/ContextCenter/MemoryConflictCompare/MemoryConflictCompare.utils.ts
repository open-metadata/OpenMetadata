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
import {
  ContextMemory,
  EntityReference,
} from '../../../generated/entity/context/contextMemory';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { MemoryConflictReviewDispute } from '../MemoryConflictReviews/MemoryConflictReviews.types';

export type DiffChange = 'added' | 'removed';

export interface DiffSegment {
  /** Position in its side: a diff can repeat the same word. */
  id: string;
  value: string;
  change?: DiffChange;
}

/** One field of the two memories, as a split diff draws it. */
export interface DiffSides {
  current: DiffSegment[];
  proposed: DiffSegment[];
  isChanged: boolean;
}

export interface MemoryDiffRow {
  key: string;
  labelKey: string;
  /** Text reads as running words; a list as separate values. */
  kind: 'text' | 'list';
  sides: DiffSides;
}

/** Word-level diff: what the current text drops and the proposed one adds. */
export const diffText = (current = '', proposed = ''): DiffSides => {
  const parts = diffWords(current, proposed);

  return {
    current: parts
      .filter((part) => !part.added)
      .map((part, index) => ({
        id: `current-${index}`,
        value: part.value,
        change: part.removed ? 'removed' : undefined,
      })),
    proposed: parts
      .filter((part) => !part.removed)
      .map((part, index) => ({
        id: `proposed-${index}`,
        value: part.value,
        change: part.added ? 'added' : undefined,
      })),
    isChanged: parts.some((part) => part.added || part.removed),
  };
};

/** Values only one side holds are what that side removes or adds. */
export const diffList = (current: string[], proposed: string[]): DiffSides => {
  const inCurrent = new Set(current);
  const inProposed = new Set(proposed);

  return {
    current: current.map((value, index) => ({
      id: `current-${index}`,
      value,
      change: inProposed.has(value) ? undefined : 'removed',
    })),
    proposed: proposed.map((value, index) => ({
      id: `proposed-${index}`,
      value,
      change: inCurrent.has(value) ? undefined : 'added',
    })),
    isChanged:
      current.some((value) => !inProposed.has(value)) ||
      proposed.some((value) => !inCurrent.has(value)),
  };
};

const presentValues = (...values: Array<string | undefined>) =>
  values.filter((value): value is string => Boolean(value));

const referenceNames = (references?: EntityReference[]) =>
  (references ?? []).map((reference) => getEntityName(reference));

const linkedAssetNames = (memory?: ContextMemory) =>
  referenceNames(
    [memory?.primaryEntity, ...(memory?.relatedEntities ?? [])].filter(
      (asset): asset is EntityReference => Boolean(asset)
    )
  );

const tagNames = (memory?: ContextMemory) =>
  (memory?.tags ?? []).map((tag) => tag.displayName || tag.name || tag.tagFQN);

const sourceOf = (memory?: ContextMemory) =>
  memory?.sourceEntity
    ? getEntityName(memory.sourceEntity)
    : memory?.sourceType;

/**
 * Every field a memory's detail view shows, current memory against the one in
 * review: text fields diff word by word, the rest value by value.
 */
export const getMemoryDiffRows = (
  current?: ContextMemory,
  proposed?: ContextMemory
): MemoryDiffRow[] => [
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
    sides: diffList(
      presentValues(current?.memoryType),
      presentValues(proposed?.memoryType)
    ),
  },
  {
    key: 'linked-assets',
    labelKey: 'label.linked-data-asset-plural',
    kind: 'list',
    sides: diffList(linkedAssetNames(current), linkedAssetNames(proposed)),
  },
  {
    key: 'visibility',
    labelKey: 'label.visibility',
    kind: 'list',
    sides: diffList(
      presentValues(current?.shareConfig?.visibility),
      presentValues(proposed?.shareConfig?.visibility)
    ),
  },
  {
    key: 'tags',
    labelKey: 'label.tag-plural',
    kind: 'list',
    sides: diffList(tagNames(current), tagNames(proposed)),
  },
  {
    key: 'source',
    labelKey: 'label.source',
    kind: 'list',
    sides: diffList(
      presentValues(sourceOf(current)),
      presentValues(sourceOf(proposed))
    ),
  },
  {
    key: 'owners',
    labelKey: 'label.owner-plural',
    kind: 'list',
    sides: diffList(
      referenceNames(current?.owners),
      referenceNames(proposed?.owners)
    ),
  },
];

/** Who owns the memory and when it last changed, as one line. */
export const getMemoryByline = (memory?: ContextMemory): string =>
  [
    memory?.owners?.[0] && getEntityName(memory.owners[0]),
    memory?.updatedAt && formatDate(memory.updatedAt),
  ]
    .filter(Boolean)
    .join(' · ');

export interface KeepHint {
  key: string;
  options: Record<string, string | number>;
}

/** What keeping each side does to the other, as translation keys. */
export const getKeepHints = (
  disputes: MemoryConflictReviewDispute[],
  reviewedTitle: string
): { approved: KeepHint; reviewed: KeepHint } =>
  disputes.length === 1
    ? {
        approved: {
          key: 'message.keep-approved-memory-hint',
          options: { title: reviewedTitle },
        },
        reviewed: {
          key: 'message.keep-reviewed-memory-hint',
          options: { title: getEntityName(disputes[0].memory) },
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
