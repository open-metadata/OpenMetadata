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
export interface OnboardingTaskBinding {
    attempt: number;
    /**
     * Fingerprint of metadata covered by the approval.
     */
    fingerprint?: string;
    /**
     * When the stall policy reassigned this task. Assignee refreshes never revert it.
     */
    reassignedAt?: number;
    /**
     * When the playbook owners were told this task had stopped moving.
     */
    stallNotifiedAt?: number;
    /**
     * Stable step identifier.
     */
    stepId:                string;
    taskId:                string;
    workflowDefinitionId?: string;
}
