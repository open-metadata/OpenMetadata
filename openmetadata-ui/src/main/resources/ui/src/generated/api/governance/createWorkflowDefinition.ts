/*
 *  Copyright 2024 Collate.
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
 * Create Workflow Definition entity request
 */
export interface CreateWorkflowDefinition {
    /**
     * Description of the Workflow Definition. What it has and how to use it.
     */
    description: string;
    /**
     * Display Name that identifies this Workflow Definition.
     */
    displayName?: string;
    /**
     * List of edges that connect the workflow elements and guide its flow.
     */
    edges?: EdgeDefinition[];
    /**
     * Name that identifies this Workflow Definition.
     */
    name: string;
    /**
     * List of processes used on the workflow.
     */
    nodes?: Definition[];
    /**
     * Owners of this API Collection
     */
    owners?:  EntityReference[];
    trigger?: EntityTriggerDefinition;
    type?:    Type;
}

/**
 * Governance Workflow Edge.
 */
export interface EdgeDefinition {
    /**
     * Defines if the edge will follow a path depending on the source node result.
     */
    condition?: boolean;
    /**
     * Element from which the edge will start.
     */
    from: string;
    /**
     * Element on which the edge will end.
     */
    to: string;
}

/**
 * Checks if an Entity attributes fit given rules.
 *
 * Sets the GlossaryTerm Status to the configured value.
 *
 * Sets the Entity Certification to the configured value.
 *
 * EndEvent.
 *
 * StartEvent.
 *
 * Defines a Task for a given User to approve.
 */
export interface Definition {
    config?: CertificationConfiguration;
    /**
     * Description of the Node.
     */
    description?: string;
    /**
     * Display Name that identifies this Node.
     */
    displayName?: string;
    input?:       string[];
    /**
     * Name that identifies this Node.
     */
    name?:    string;
    output?:  string[];
    subType?: string;
    type?:    string;
    [property: string]: any;
}

export interface CertificationConfiguration {
    rules?:              string;
    glossaryTermStatus?: Status;
    certification?:      CertificationEnum;
    /**
     * People/Teams assigned to the Task.
     */
    assignees?: Assignees;
}

/**
 * People/Teams assigned to the Task.
 */
export interface Assignees {
    /**
     * Add the Reviewers to the assignees List.
     */
    addReviewers?: boolean;
    [property: string]: any;
}

export enum CertificationEnum {
    CertificationBronze = "Certification.Bronze",
    CertificationGold = "Certification.Gold",
    CertificationSilver = "Certification.Silver",
    Empty = "",
}

export enum Status {
    Approved = "Approved",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
    Rejected = "Rejected",
}

/**
 * Owners of this API Collection
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
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
 * Event Based Entity Trigger.
 *
 * Periodic Batch Entity Trigger.
 */
export interface EntityTriggerDefinition {
    config?: Config;
    output?: string[];
    type?:   string;
}

/**
 * Entity Event Trigger Configuration.
 */
export interface Config {
    /**
     * Entity Type for which it should be triggered.
     */
    entityType: string;
    events?:    Event[];
    /**
     * Exclude events that only modify given attributes.
     */
    exclude?: string[];
    /**
     * Number of Entities to process at once.
     */
    batchSize?: number;
    /**
     * Search Filters to filter down the entities fetched.
     */
    filters?: string;
    /**
     * Defines the schedule of the Periodic Trigger.
     */
    schedule?: any[] | boolean | AppScheduleClass | number | number | null | string;
}

/**
 * Event for which it should be triggered.
 */
export enum Event {
    Created = "Created",
    Updated = "Updated",
}

export interface AppScheduleClass {
    /**
     * Cron Expression in case of Custom scheduled Trigger
     */
    cronExpression?:  string;
    scheduleTimeline: ScheduleTimeline;
}

/**
 * This schema defines the Application ScheduleTimeline Options
 */
export enum ScheduleTimeline {
    Custom = "Custom",
    Daily = " Daily",
    Hourly = "Hourly",
    Monthly = "Monthly",
    None = "None",
    Weekly = "Weekly",
}

export enum Type {
    EventBasedEntityWorkflow = "eventBasedEntityWorkflow",
    PeriodicBatchEntityWorkflow = "periodicBatchEntityWorkflow",
}
