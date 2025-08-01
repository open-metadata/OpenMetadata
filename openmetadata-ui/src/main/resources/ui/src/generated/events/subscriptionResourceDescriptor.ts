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
 * Subscription descriptor
 */
export interface SubscriptionResourceDescriptor {
    /**
     * Name of the resource. For entity related resources, resource name is same as the entity
     * name. Some resources such as lineage are not entities but are resources.
     */
    name?: string;
    /**
     * List of operations supported filters by the resource.
     */
    supportedFilters?: Operation[];
}

/**
 * This schema defines all possible filter operations on metadata of entities in
 * OpenMetadata.
 */
export enum Operation {
    FilterByDomain = "filterByDomain",
    FilterByEntityID = "filterByEntityId",
    FilterByEventType = "filterByEventType",
    FilterByFieldChange = "filterByFieldChange",
    FilterByFqn = "filterByFqn",
    FilterByGeneralMetadataEvents = "filterByGeneralMetadataEvents",
    FilterByMentionedName = "filterByMentionedName",
    FilterByOwnerName = "filterByOwnerName",
    FilterBySource = "filterBySource",
    FilterByUpdaterIsBot = "filterByUpdaterIsBot",
    FilterByUpdaterName = "filterByUpdaterName",
}
