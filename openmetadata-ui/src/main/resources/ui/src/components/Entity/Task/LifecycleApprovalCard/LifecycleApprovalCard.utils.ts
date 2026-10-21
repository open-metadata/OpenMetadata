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
import { LifecycleMove } from '../../../../generated/governance/workflows/elements/nodes/userTask/userApprovalTask';

/** The stage move a lifecycle approval gates; other approvals carry none. */
export const getLifecycleMove = (payload: unknown): LifecycleMove | null => {
  const move = (payload as { lifecycleMove?: Partial<LifecycleMove> } | null)
    ?.lifecycleMove;

  return move?.stage && move.targetStage ? (move as LifecycleMove) : null;
};
