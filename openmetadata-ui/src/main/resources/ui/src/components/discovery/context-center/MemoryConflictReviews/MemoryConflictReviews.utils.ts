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
  ContextMemory,
  EntityReference,
} from '../../../../generated/entity/context/contextMemory';
import { Task } from '../../../../generated/entity/tasks/task';
import { DisputedMemory } from '../../../../generated/type/memoryConflictReviewPayload';
import { ConflictRecency } from './MemoryConflictReviews.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toDispute = (value: unknown): DisputedMemory | undefined => {
  if (!isRecord(value) || !isRecord(value.memory)) {
    return undefined;
  }
  const memory = value.memory as unknown as EntityReference;
  const detectedAt =
    typeof value.detectedAt === 'number' ? value.detectedAt : undefined;

  return memory.id ? { memory, detectedAt } : undefined;
};

/**
 * The memories a conflict review weighs the reviewed memory against, as the
 * server recorded them. Malformed entries are skipped.
 */
export const getReviewDisputes = (task: Task): DisputedMemory[] => {
  const disputes = isRecord(task.payload) ? task.payload.disputes : undefined;

  return Array.isArray(disputes)
    ? disputes
        .map(toDispute)
        .filter((dispute): dispute is DisputedMemory => Boolean(dispute))
    : [];
};

/**
 * When a memory's claim last changed. Review, lifecycle and pin writes keep
 * `lastContentUpdatedAt`, so it dates what the memory says, where `updatedAt`
 * dates any write.
 */
export const getClaimUpdatedAt = (memory?: ContextMemory): number | undefined =>
  memory?.lastContentUpdatedAt ?? memory?.updatedAt;

/**
 * Which side states the more recent claim. The reviewed memory is newer only
 * when it is newer than every claim it contradicts, and older only when it is
 * older than all of them.
 */
export const getConflictRecency = (
  reviewed: ContextMemory | undefined,
  disputed: ContextMemory[]
): ConflictRecency => {
  const reviewedAt = getClaimUpdatedAt(reviewed);
  const recency: ConflictRecency = { disputed: {} };
  if (reviewedAt === undefined) {
    return recency;
  }
  const dated = disputed.filter(
    (memory) => getClaimUpdatedAt(memory) !== undefined
  );
  dated.forEach((memory) => {
    const disputedAt = getClaimUpdatedAt(memory) ?? reviewedAt;
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

/** Why the reviewed memory contradicts a disputed one, as the memory records it. */
export const getDisputeReason = (
  reviewed: ContextMemory | undefined,
  disputedId: string | undefined
): string | undefined =>
  reviewed?.disputes?.find(({ memory }) => memory.id === disputedId)?.reason;

/**
 * The review as a task list shows it, with the memory it is about named by its
 * title: memory names are generated, so the reference's name reads as noise.
 */
export const withMemoryTitle = (review: Task, memory?: ContextMemory): Task =>
  memory?.title && review.about
    ? { ...review, about: { ...review.about, displayName: memory.title } }
    : review;
