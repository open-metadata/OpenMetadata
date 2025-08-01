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
 * Schema to capture test case resolution status.
 */
export interface TestCaseResolutionStatus {
    /**
     * Unique identifier of this failure instance
     */
    id?: string;
    /**
     * List of metrics associated with the test case resolution.
     */
    metrics?: Array<any[] | boolean | number | number | null | MetricObject | string>;
    /**
     * Severity failure for the test associated with the resolution.
     */
    severity?: Severities;
    /**
     * Sequence ID for a failure status. Statuses belonging to the same sequence will have the
     * same ID. Unique across a failure cycle, i.e. new -> ack -> ... -> resolved.
     */
    stateId?: string;
    /**
     * Test case reference
     */
    testCaseReference?: EntityReference;
    /**
     * Details of the test case failure status.
     */
    testCaseResolutionStatusDetails?: Assigned;
    /**
     * Status of Test Case Acknowledgement.
     */
    testCaseResolutionStatusType: TestCaseResolutionStatusTypes;
    /**
     * Timestamp on which the failure was created.
     */
    timestamp?: number;
    /**
     * Time when test case resolution was updated.
     */
    updatedAt?: number;
    /**
     * User who updated the test case failure status.
     */
    updatedBy?: EntityReference;
}

export interface MetricObject {
    /**
     * Name of the metric.
     */
    name?: string;
    /**
     * Value of the metric.
     */
    value?: number;
    [property: string]: any;
}

/**
 * Severity failure for the test associated with the resolution.
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
 * Test case reference
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * User working on failure resolution.
 *
 * User who resolved the test case failure.
 *
 * User who updated the test case failure status.
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
 * Details of the test case failure status.
 *
 * test case failure details for assigned failures
 *
 * test case failure details for resolved failures
 */
export interface Assigned {
    /**
     * User working on failure resolution.
     */
    assignee?: EntityReference;
    /**
     * User who resolved the test case failure.
     */
    resolvedBy?: EntityReference;
    /**
     * Test case failure resolution comment.
     */
    testCaseFailureComment?: string;
    /**
     * Reason of Test Case resolution.
     */
    testCaseFailureReason?: TestCaseFailureReasonType;
}

/**
 * Reason of Test Case resolution.
 *
 * Reason of Test Case initial failure.
 */
export enum TestCaseFailureReasonType {
    Duplicates = "Duplicates",
    FalsePositive = "FalsePositive",
    MissingData = "MissingData",
    Other = "Other",
    OutOfBounds = "OutOfBounds",
}

/**
 * Status of Test Case Acknowledgement.
 *
 * Test case resolution status type.
 */
export enum TestCaseResolutionStatusTypes {
    ACK = "Ack",
    Assigned = "Assigned",
    New = "New",
    Resolved = "Resolved",
}
