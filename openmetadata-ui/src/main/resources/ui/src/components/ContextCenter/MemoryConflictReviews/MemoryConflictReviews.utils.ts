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
import { EntityReference } from '../../../generated/entity/context/contextMemory';
import { Task } from '../../../generated/entity/tasks/task';
import {
  ConflictRecency,
  MemoryClaim,
  MemoryConflictReviewDispute,
} from './MemoryConflictReviews.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toClaim = (value: unknown): MemoryClaim | undefined =>
  isRecord(value) && typeof value.id === 'string'
    ? (value as unknown as MemoryClaim)
    : undefined;

const toDispute = (value: unknown): MemoryConflictReviewDispute | undefined => {
  if (!isRecord(value) || !isRecord(value.memory)) {
    return undefined;
  }
  const memory = value.memory as unknown as EntityReference;
  const reason = typeof value.reason === 'string' ? value.reason : '';

  return memory.id
    ? { memory, reason, claim: toClaim(value.claim) }
    : undefined;
};

/**
 * The memories a conflict review weighs the reviewed memory against, as the
 * server recorded them when it opened the task. Malformed entries are skipped.
 */
export const getReviewDisputes = (
  task: Task
): MemoryConflictReviewDispute[] => {
  const disputes = isRecord(task.payload) ? task.payload.disputes : undefined;

  return Array.isArray(disputes)
    ? disputes
        .map(toDispute)
        .filter((dispute): dispute is MemoryConflictReviewDispute =>
          Boolean(dispute)
        )
    : [];
};

/** What the reviewed memory claims, as recorded when the review opened. */
export const getReviewedClaim = (task: Task): MemoryClaim | undefined =>
  isRecord(task.payload) ? toClaim(task.payload.claim) : undefined;

/**
 * The reviewed memory's title as the server recorded it on the task. Memory
 * names are generated, so a title is what a reviewer recognises; the task's
 * `about` reference carries only the name.
 */
export const getReviewedMemoryTitle = (task: Task): string | undefined => {
  const title = isRecord(task.payload) ? task.payload.memoryTitle : undefined;

  return typeof title === 'string' && title.trim() ? title : undefined;
};

/**
 * Which side states the more recent claim, by when each claim's content last
 * changed. The reviewed memory is newer only when it is newer than every claim
 * it contradicts, and older only when it is older than all of them.
 */
export const getConflictRecency = (
  reviewed: MemoryClaim | undefined,
  disputes: MemoryConflictReviewDispute[]
): ConflictRecency => {
  const reviewedAt = reviewed?.contentUpdatedAt;
  const recency: ConflictRecency = { disputed: {} };
  if (reviewedAt === undefined) {
    return recency;
  }
  const dated = disputes.filter(
    (dispute) => dispute.claim?.contentUpdatedAt !== undefined
  );
  dated.forEach(({ memory, claim }) => {
    const disputedAt = claim?.contentUpdatedAt ?? reviewedAt;
    if (disputedAt !== reviewedAt) {
      recency.disputed[memory.id] = disputedAt > reviewedAt ? 'newer' : 'older';
    }
  });
  const sides = Object.values(recency.disputed);
  if (dated.length > 0 && sides.length === dated.length) {
    if (sides.every((side) => side === 'older')) {
      recency.reviewed = 'newer';
    } else if (sides.every((side) => side === 'newer')) {
      recency.reviewed = 'older';
    }
  }

  return recency;
};

/** A memory's URL name, which Context Center opens through `?memory=`. */
export const getMemoryLinkName = (memory?: EntityReference): string =>
  memory?.name ?? memory?.fullyQualifiedName ?? '';
