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
/**
 * Payload for Description Update tasks.
 */
export interface DescriptionUpdatePayload {
    /**
     * Confidence score for AI-generated descriptions (0-100).
     */
    confidence?: number;
    /**
     * Current description value.
     */
    currentDescription?: string;
    /**
     * Path to the field being updated (e.g., 'columns.customer_id.description' or just
     * 'description' for entity-level).
     */
    fieldPath?: string;
    /**
     * Proposed new description value.
     */
    newDescription: string;
    /**
     * Source of the update request.
     */
    source?: Source;
}

/**
 * Source of the update request.
 */
export enum Source {
    Agent = "Agent",
    AutoPilot = "AutoPilot",
    Ingestion = "Ingestion",
    User = "User",
}
