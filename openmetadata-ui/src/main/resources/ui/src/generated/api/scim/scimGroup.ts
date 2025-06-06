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
 * SCIM-compliant Group object
 */
export interface ScimGroup {
    /**
     * Whether the group is active
     */
    active?: boolean;
    /**
     * Human-readable name of the group
     */
    displayName: string;
    /**
     * External system identifier
     */
    externalId?: string;
    /**
     * Unique identifier for the group
     */
    id?: string;
    /**
     * Members of the group
     */
    members?: Member[];
    /**
     * Metadata about the group
     */
    meta?: Meta;
    /**
     * SCIM schemas used for this resource
     */
    schemas: string[];
    [property: string]: any;
}

export interface Member {
    /**
     * Display name of the member
     */
    display?: string;
    /**
     * Type of member - typically 'User'
     */
    type?: string;
    /**
     * ID of the member (user)
     */
    value: string;
    [property: string]: any;
}

/**
 * Metadata about the group
 */
export interface Meta {
    created?:      Date;
    lastModified?: Date;
    location?:     string;
    resourceType?: string;
    [property: string]: any;
}
