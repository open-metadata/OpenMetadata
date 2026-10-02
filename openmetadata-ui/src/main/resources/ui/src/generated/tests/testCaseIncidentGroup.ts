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
     * Number of distinct current assignees across the group's open incidents.
     */
    assigneeCount?: number;
    /**
     * Distinct names of the current assignees of the group's open incidents.
     */
    assignees?: string[];
    /**
     * Display name of the entity the group represents.
     */
    displayName?: string;
    /**
     * Timestamp at which the earliest open incident in the group was opened.
     */
    firstSeen?: number;
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
     * Timestamp of the most recent status change across the group's open incidents.
     */
    lastSeen?: number;
    /**
     * Name of the entity the group represents.
     */
    name: string;
    /**
     * Most critical severity across the group's open incidents (Severity1 is the most
     * critical). Absent when no incident in the group has a severity.
     */
    severity?: Severities;
    /**
     * Most actionable current status across the group's open incidents, in the order Assigned >
     * Ack > New.
     */
    status?: TestCaseResolutionStatusTypes;
    /**
     * Number of the group's open incidents in each current status, most actionable first. A
     * status no incident sits in is left out, and `Resolved` never appears — a resolved
     * incident leaves the group.
     */
    statusCounts?: IncidentStatusCount[];
    /**
     * Number of distinct tables the group's open incidents were raised on.
     */
    tableCount?: number;
    /**
     * Tables the group's open incidents were raised on, the one with the most open incidents
     * first. Capped at a handful; `tableCount` holds the full count.
     */
    tables?: EntityReference[];
    /**
     * Number of distinct test definitions across the group's open incidents.
     */
    testDefinitionCount?: number;
    /**
     * Test definitions of the group's open incidents, the one with the most open incidents
     * first. Capped at a handful; `testDefinitionCount` holds the full count.
     */
    testDefinitions?: EntityReference[];
    /**
     * Number of incidents opened in each of 8 equal time buckets spanning `firstSeen` to
     * `lastSeen`.
     */
    trend?: number[];
    /**
     * Direction of the incident-creation trend for the group.
     */
    trendDirection?: IncidentTrendDirection;
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

/**
 * Most critical severity across the group's open incidents (Severity1 is the most
 * critical). Absent when no incident in the group has a severity.
 *
 * Test case resolution status type.
 */
export enum Severities {
    Severity1 = "Severity1",
    Severity2 = "Severity2",
    Severity3 = "Severity3",
    Severity4 = "Severity4",
    Severity5 = "Severity5",
}

/**
 * Most actionable current status across the group's open incidents, in the order Assigned >
 * Ack > New.
 *
 * Test case resolution status type.
 *
 * Current status the incidents are in.
 */
export enum TestCaseResolutionStatusTypes {
    ACK = "Ack",
    Assigned = "Assigned",
    New = "New",
    Resolved = "Resolved",
}

/**
 * Number of the group's open incidents currently sitting in one status.
 */
export interface IncidentStatusCount {
    /**
     * Number of the group's open incidents in that status.
     */
    count: number;
    /**
     * Current status the incidents are in.
     */
    status: TestCaseResolutionStatusTypes;
}

/**
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}

/**
 * Direction of the incident-creation trend for the group.
 *
 * Direction of the group's incident-creation trend, comparing the second half of the
 * `trend` buckets against the first half.
 */
export enum IncidentTrendDirection {
    Falling = "Falling",
    Rising = "Rising",
    Steady = "Steady",
}
