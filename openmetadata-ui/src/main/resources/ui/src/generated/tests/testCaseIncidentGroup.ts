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
 * Aggregated count of open test case incidents for a given grouping dimension.
 */
export interface TestCaseIncidentGroup {
    /**
     * Display name of the entity the group represents.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity the group represents.
     */
    fullyQualifiedName?: string;
    /**
     * Dimension the incidents are grouped by.
     */
    groupBy: IncidentGroupBy;
    /**
     * Unique identifier of the entity the group represents.
     */
    id?: string;
    /**
     * Number of distinct open incidents in the group.
     */
    incidentCount: number;
    /**
     * Name of the entity the group represents.
     */
    name: string;
}

/**
 * Dimension the incidents are grouped by.
 *
 * Dimension used to group test case incidents.
 */
export enum IncidentGroupBy {
    Owner = "owner",
    Table = "table",
    TestDefinition = "testDefinition",
}
