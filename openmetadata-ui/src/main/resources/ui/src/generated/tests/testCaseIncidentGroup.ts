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
 */
export enum TestCaseResolutionStatusTypes {
    ACK = "Ack",
    Assigned = "Assigned",
    New = "New",
    Resolved = "Resolved",
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
