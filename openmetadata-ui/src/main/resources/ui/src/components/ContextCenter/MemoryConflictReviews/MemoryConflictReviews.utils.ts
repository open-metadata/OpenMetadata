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
import { MemoryConflictReviewDispute } from './MemoryConflictReviews.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toDispute = (value: unknown): MemoryConflictReviewDispute | undefined => {
  if (!isRecord(value) || !isRecord(value.memory)) {
    return undefined;
  }
  const memory = value.memory as unknown as EntityReference;
  const reason = typeof value.reason === 'string' ? value.reason : '';

  return memory.id ? { memory, reason } : undefined;
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

/** A memory's URL name, which Context Center opens through `?memory=`. */
export const getMemoryLinkName = (memory?: EntityReference): string =>
  memory?.name ?? memory?.fullyQualifiedName ?? '';
