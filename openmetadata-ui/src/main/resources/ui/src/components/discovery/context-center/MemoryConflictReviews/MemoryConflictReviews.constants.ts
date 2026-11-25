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
import { ResolutionType } from '../../../../generated/api/tasks/resolveTask';
import { ClaimRecency } from './MemoryConflictReviews.types';

/** The server-opened task's transition ids and the resolution each records. */
export const REVIEW_DECISIONS = {
  approve: ResolutionType.Approved,
  reject: ResolutionType.Rejected,
} as const;

export type ReviewDecision = keyof typeof REVIEW_DECISIONS;

export const CLAIM_RECENCY_LABELS: Record<ClaimRecency, string> = {
  newer: 'label.newer',
  older: 'label.older',
};
