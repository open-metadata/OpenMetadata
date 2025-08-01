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
 * TestSuite is a set of test cases grouped together to capture data quality tests against
 * data entities.
 */
export interface TestSuite {
    /**
     * Indicates if the test suite is basic, i.e., the parent suite of a test and linked to an
     * entity. Set on the backend.
     */
    basic?: boolean;
    /**
     * Entity reference the test suite needs to execute the test against. Only applicable if the
     * test suite is basic.
     */
    basicEntityReference?: EntityReference;
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * TestSuite mock connection, since it needs to implement a Service.
     */
    connection?: TestSuiteConnection;
    /**
     * Reference to the data contract that this test suite is associated with.
     */
    dataContract?: EntityReference;
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of the test suite.
     */
    description?: string;
    /**
     * Display Name that identifies this test suite.
     */
    displayName?: string;
    /**
     * Domains the test Suite belongs to. When not set, the test Suite inherits the domain from
     * the table it belongs to.
     */
    domains?: EntityReference[];
    /**
     * DEPRECATED in 1.6.2: Use 'basic'
     */
    executable?: boolean;
    /**
     * DEPRECATED in 1.6.2: Use 'basicEntityReference'.
     */
    executableEntityReference?: EntityReference;
    /**
     * FullyQualifiedName same as `name`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    /**
     * Unique identifier of this test suite instance.
     */
    id?: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Indicates if the test suite is inherited from a parent entity.
     */
    inherited?: boolean;
    /**
     * Name that identifies this test suite.
     */
    name: string;
    /**
     * Owners of this TestCase definition.
     */
    owners?: EntityReference[];
    /**
     * References to pipelines deployed for this Test Suite to execute the tests.
     */
    pipelines?: EntityReference[];
    /**
     * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
     */
    serviceType?: ServiceType;
    /**
     * Summary of the previous day test cases execution for this test suite.
     */
    summary?: TestSummary;
    /**
     * Tags for this test suite. This is an inherited field from the parent entity if the
     * testSuite is native.
     */
    tags?: TagLabel[];
    /**
     * Summary of test case execution
     */
    testCaseResultSummary?: Array<any[] | boolean | number | number | null | TestCaseResultSummaryObject | string>;
    /**
     * Result of the test connection.
     */
    testConnectionResult?: TestConnectionResult;
    tests?:                EntityReference[];
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    /**
     * Metadata version of the entity.
     */
    version?: number;
}

/**
 * Entity reference the test suite needs to execute the test against. Only applicable if the
 * test suite is basic.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Reference to the data contract that this test suite is associated with.
 *
 * Domains the test Suite belongs to. When not set, the test Suite inherits the domain from
 * the table it belongs to.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * DEPRECATED in 1.6.2: Use 'basicEntityReference'.
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
 * Change that lead to this version of the entity.
 *
 * Description of the change.
 */
export interface ChangeDescription {
    changeSummary?: { [key: string]: ChangeSummary };
    /**
     * Names of fields added during the version changes.
     */
    fieldsAdded?: FieldChange[];
    /**
     * Fields deleted during the version changes with old value before deleted.
     */
    fieldsDeleted?: FieldChange[];
    /**
     * Fields modified during the version changes with old and new values.
     */
    fieldsUpdated?: FieldChange[];
    /**
     * When a change did not result in change, this could be same as the current version.
     */
    previousVersion?: number;
}

export interface ChangeSummary {
    changedAt?: number;
    /**
     * Name of the user or bot who made this change
     */
    changedBy?:    string;
    changeSource?: ChangeSource;
    [property: string]: any;
}

/**
 * The source of the change. This will change based on the context of the change (example:
 * manual vs programmatic)
 */
export enum ChangeSource {
    Automated = "Automated",
    Derived = "Derived",
    Ingested = "Ingested",
    Manual = "Manual",
    Propagated = "Propagated",
    Suggested = "Suggested",
}

export interface FieldChange {
    /**
     * Name of the entity field that changed.
     */
    name?: string;
    /**
     * New value of the field. Note that this is a JSON string and use the corresponding field
     * type to deserialize it.
     */
    newValue?: any;
    /**
     * Previous value of the field. Note that this is a JSON string and use the corresponding
     * field type to deserialize it.
     */
    oldValue?: any;
}

/**
 * TestSuite mock connection, since it needs to implement a Service.
 */
export interface TestSuiteConnection {
    config?: null;
    [property: string]: any;
}

/**
 * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
 */
export enum ServiceType {
    TestSuite = "TestSuite",
}

/**
 * Summary of the previous day test cases execution for this test suite.
 *
 * Schema to capture test case execution summary.
 */
export interface TestSummary {
    /**
     * Number of test cases that aborted.
     */
    aborted?:           number;
    columnTestSummary?: ColumnTestSummaryDefinition[];
    /**
     * Number of test cases that failed.
     */
    failed?: number;
    /**
     * Number of test cases that are queued for execution.
     */
    queued?: number;
    /**
     * Number of test cases that passed.
     */
    success?: number;
    /**
     * Total number of test cases.
     */
    total?: number;
    [property: string]: any;
}

/**
 * Schema to capture test case execution summary at the column level.
 */
export interface ColumnTestSummaryDefinition {
    /**
     * Number of test cases that aborted.
     */
    aborted?:    number;
    entityLink?: string;
    /**
     * Number of test cases that failed.
     */
    failed?: number;
    /**
     * Number of test cases that are queued for execution.
     */
    queued?: number;
    /**
     * Number of test cases that passed.
     */
    success?: number;
    /**
     * Total number of test cases.
     */
    total?: number;
    [property: string]: any;
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 */
export interface TagLabel {
    /**
     * Description for the tag label.
     */
    description?: string;
    /**
     * Display Name that identifies this tag.
     */
    displayName?: string;
    /**
     * Link to the tag resource.
     */
    href?: string;
    /**
     * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
     * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
     * relationship (see Classification.json for more details). 'Propagated` indicates a tag
     * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
     * used to determine the tag label.
     */
    labelType: LabelType;
    /**
     * Name of the tag or glossary term.
     */
    name?: string;
    /**
     * Label is from Tags or Glossary.
     */
    source: TagSource;
    /**
     * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
     * entity must confirm the suggested labels before it is marked as 'Confirmed'.
     */
    state:  State;
    style?: Style;
    tagFQN: string;
}

/**
 * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
 * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
 * relationship (see Classification.json for more details). 'Propagated` indicates a tag
 * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
 * used to determine the tag label.
 */
export enum LabelType {
    Automated = "Automated",
    Derived = "Derived",
    Generated = "Generated",
    Manual = "Manual",
    Propagated = "Propagated",
}

/**
 * Label is from Tags or Glossary.
 */
export enum TagSource {
    Classification = "Classification",
    Glossary = "Glossary",
}

/**
 * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
 * entity must confirm the suggested labels before it is marked as 'Confirmed'.
 */
export enum State {
    Confirmed = "Confirmed",
    Suggested = "Suggested",
}

/**
 * UI Style is used to associate a color code and/or icon to entity to customize the look of
 * that entity in UI.
 */
export interface Style {
    /**
     * Hex Color Code to mark an entity such as GlossaryTerm, Tag, Domain or Data Product.
     */
    color?: string;
    /**
     * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
     */
    iconURL?: string;
}

export interface TestCaseResultSummaryObject {
    /**
     * Status of the test case.
     */
    status?: TestCaseStatus;
    /**
     * Name of the test case.
     */
    testCaseName?: string;
    /**
     * Timestamp of the test case execution.
     */
    timestamp?: number;
    [property: string]: any;
}

/**
 * Status of the test case.
 *
 * Status of Test Case run.
 */
export enum TestCaseStatus {
    Aborted = "Aborted",
    Failed = "Failed",
    Queued = "Queued",
    Success = "Success",
}

/**
 * Result of the test connection.
 *
 * TestConnectionResult is the definition that will encapsulate result of running the test
 * connection steps.
 */
export interface TestConnectionResult {
    /**
     * Last time that the test connection was executed
     */
    lastUpdatedAt?: number;
    /**
     * Test Connection Result computation status.
     */
    status?: StatusType;
    /**
     * Steps to test the connection. Order matters.
     */
    steps: TestConnectionStepResult[];
}

/**
 * Test Connection Result computation status.
 *
 * Enum defining possible Test Connection Result status
 */
export enum StatusType {
    Failed = "Failed",
    Running = "Running",
    Successful = "Successful",
}

/**
 * Function that tests one specific element of the service. E.g., listing schemas, lineage,
 * or tags.
 */
export interface TestConnectionStepResult {
    /**
     * In case of failed step, this field would contain the actual error faced during the step.
     */
    errorLog?: string;
    /**
     * Is this step mandatory to be passed?
     */
    mandatory: boolean;
    /**
     * Results or exceptions to be shared after running the test. This message comes from the
     * test connection definition
     */
    message?: string;
    /**
     * Name of the step being tested
     */
    name: string;
    /**
     * Did the step pass successfully?
     */
    passed: boolean;
}
