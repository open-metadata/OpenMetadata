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
 * Curated AI governance activity feed response.
 */
export interface AIGovernanceActivityResponse {
    /**
     * Governance activity events.
     */
    events: AIGovernanceActivityEvent[];
}

/**
 * Single governance-significant activity event.
 */
export interface AIGovernanceActivityEvent {
    at:        number;
    createdAt: number;
    /**
     * Display name of the AI asset associated with the event.
     */
    entityDisplayName?: string;
    /**
     * Fully qualified name of the AI asset associated with the event.
     */
    entityFqn?: string;
    /**
     * Identifier of the AI asset associated with the event.
     */
    entityId?: string;
    /**
     * Name of the AI asset associated with the event.
     */
    entityName?: string;
    /**
     * Type of AI asset associated with the event.
     */
    entityType:   string;
    scheduledAt?: number;
    /**
     * Human-readable event summary.
     */
    text: string;
    /**
     * Governance event type.
     */
    type: string;
    /**
     * User associated with the event.
     */
    who?: string;
}
