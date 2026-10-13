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
import { EntityReference } from '../../../../generated/entity/context/contextMemory';
import { Task } from '../../../../generated/entity/tasks/task';

/**
 * A memory the reviewed one contradicts, as the task records it: by reference
 * only. Every user may read tasks, so what a memory says is read through the
 * memory API, which applies its visibility rules.
 */
export interface MemoryConflictReviewDispute {
  memory: EntityReference;
  detectedAt?: number;
}

export type ClaimRecency = 'newer' | 'older';

export interface ConflictRecency {
  reviewed?: ClaimRecency;
  disputed: Record<string, ClaimRecency>;
}

export interface MemoryConflictReviewsProps {
  reviews: Task[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onResolved: () => void;
}
