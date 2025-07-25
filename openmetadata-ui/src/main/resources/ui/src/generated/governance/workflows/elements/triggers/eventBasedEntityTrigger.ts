/*
 *  Copyright 2025 Collate.
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
 * Event Based Entity Trigger.
 */
export interface EventBasedEntityTrigger {
    config?: TriggerConfiguration;
    output?: string[];
    type?:   string;
}

/**
 * Entity Event Trigger Configuration.
 */
export interface TriggerConfiguration {
    /**
     * Entity Type for which it should be triggered.
     */
    entityType: string;
    events:     Event[];
    /**
     * Select fields that should not trigger the workflow if only them are modified.
     */
    exclude?: string[];
    /**
     * JSON Logic expression to determine if the workflow should be triggered. The expression
     * has access to: entity (current entity), changeDescription (what changed), updatedBy (user
     * who made the change), changedFields (array of field names that changed).
     */
    filter?: string;
}

/**
 * Event for which it should be triggered.
 */
export enum Event {
    Created = "Created",
    Updated = "Updated",
}
