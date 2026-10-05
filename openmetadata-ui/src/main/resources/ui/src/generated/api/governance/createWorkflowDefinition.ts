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
 * Create Workflow Definition entity request
 */
export interface CreateWorkflowDefinition {
    /**
     * Configuration for the Workflow Definition
     */
    config?: WorkflowConfiguration;
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
    nodes?: CheckEntityAttributesTaskDefinition[];
    /**
     * Owners of this API Collection
     */
    owners?:  EntityReference[];
    trigger?: EntityTriggerDefinition;
    type?:    Type;
}

/**
 * Configuration for the Workflow Definition
 */
export interface WorkflowConfiguration {
    lifecycle?: LifecycleConfiguration;
    /**
     * If True, all the stage status will be stored in the database.
     */
    storeStageStatus: boolean;
}

/**
 * Optional presentation metadata for guided lifecycle workflows. Executable nodes and edges
 * remain authoritative; editors must verify that the metadata compiles to the saved graph
 * before editing it as stages.
 */
export interface LifecycleConfiguration {
    entityType: EntityType;
    gates:      LifecycleGate[];
    /**
     * Names of workflows whose checks were explicitly imported by an administrator. Importing
     * metadata does not suspend or delete these workflows.
     */
    sourceWorkflows?: string[];
    version:          number;
}

export enum EntityType {
    DataProduct = "dataProduct",
    Domain = "domain",
    GlossaryTerm = "glossaryTerm",
    Metric = "metric",
}

export interface LifecycleGate {
    /**
     * Optional advanced JSON Logic condition evaluated in addition to the checklist.
     */
    additionalRules?: string;
    checks:           LifecycleFieldCheck[];
    stage:            EntityStatus;
}

/**
 * A field-presence check. Only blocking checks participate in a stage gate. An appliesWhen
 * expression that evaluates to false skips the check.
 */
export interface LifecycleFieldCheck {
    /**
     * Optional JSON Logic expression against the entity.
     */
    appliesWhen?: string;
    example?:     string;
    field:        string;
    /**
     * Fields for a completeness check; the executable completeness node enforces a non-empty
     * selection.
     */
    fieldsToCheck?: string[];
    guidance?:      string;
    kind?:          Kind;
    minimumScore?:  number;
    requirement:    Requirement;
    /**
     * Optional metadata collection task. The field check, rather than task approval, controls
     * stage advancement.
     */
    task?: Task;
    /**
     * Number and boolean fields accept zero and false as present values.
     */
    valueType?: ValueType;
}

export enum Kind {
    Completeness = "completeness",
    Field = "field",
}

export enum Requirement {
    Blocking = "blocking",
    Optional = "optional",
    Recommended = "recommended",
}

/**
 * Optional metadata collection task. The field check, rather than task approval, controls
 * stage advancement.
 */
export interface Task {
    assignees:   TaskAssigneesEnum;
    candidates?: EntityReference[];
}

export enum TaskAssigneesEnum {
    Candidates = "candidates",
    Owners = "owners",
    Reviewers = "reviewers",
}

/**
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owners of this API Collection
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
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
 * Number and boolean fields accept zero and false as present values.
 */
export enum ValueType {
    Boolean = "boolean",
    Collection = "collection",
    Number = "number",
    Text = "text",
}

/**
 * Lifecycle stage of an entity, shared by every entity type that declares an `entityStatus`
 * property. Entity types without that property have no lifecycle. When a create request
 * omits the stage, the server assigns the entity type's initial stage.
 */
export enum EntityStatus {
    Approved = "Approved",
    Archived = "Archived",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
    Rejected = "Rejected",
    Unprocessed = "Unprocessed",
}

/**
 * Governance Workflow Edge.
 */
export interface EdgeDefinition {
    /**
     * Defines if the edge will follow a path depending on the source node result.
     */
    condition?: string;
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
 * Evaluates entity data completeness based on field presence and outputs quality bands.
 *
 * Sets any Entity attribute field to the configured value.
 *
 * EndEvent.
 *
 * StartEvent.
 *
 * Defines a Task for a given User to approve.
 *
 * Runs the Policy Agent to enforce data access on supported connectors, or falls back to a
 * manual grant step.
 *
 * Creates (or updates) a service-scoped AI Automation from a seed template and runs it.
 *
 * Maintains an assigned metadata task while an entity field fails its check. Stage gates
 * decide whether a missing field blocks advancement.
 */
export interface CheckEntityAttributesTaskDefinition {
    /**
     * Outgoing branches this node's delegate can emit. Grant path uses ['granted', 'manual',
     * 'denied']; revoke path (accessType override = Revoke) uses ['revoked', 'manual']. Node
     * authors declare only the branches their delegate actually emits, and each declared branch
     * must have a matching outgoing edge in the workflow.
     */
    branches?: string[];
    config?:   NodeConfiguration;
    /**
     * Description of the Node.
     *
     * Description of what this completeness check does
     */
    description?: string;
    /**
     * Display Name that identifies this Node.
     *
     * User-friendly display name for this node
     */
    displayName?:       string;
    input?:             string[];
    inputNamespaceMap?: InputNamespaceMap;
    /**
     * Name that identifies this Node.
     *
     * Unique name that identifies this node in the workflow
     */
    name?:    string;
    subType?: string;
    type?:    string;
    /**
     * Variables this node outputs for use in subsequent nodes
     */
    output?: string[];
    [property: string]: any;
}

export interface NodeConfiguration {
    /**
     * Define certain set of rules that you would like to check. If all the rules apply, this
     * will be set as 'True' and will continue through the positive flow. Otherwise it will be
     * set to 'False' and continue through the negative flow.
     */
    rules?: string;
    /**
     * List of entity field paths to evaluate. Supports dot notation for nested fields (e.g.,
     * 'owner.name', 'columns[].description')
     */
    fieldsToCheck?: string[];
    /**
     * Define quality levels based on completeness scores. Bands are evaluated from highest to
     * lowest score.
     */
    qualityBands?: QualityBand[];
    /**
     * Entity field name to set (e.g., 'status', 'description', 'displayName')
     */
    fieldName?: string;
    /**
     * Value to set for the field
     */
    fieldValue?: string;
    /**
     * Number of reviewers that must approve for the task to be completed. Default is 1 (any
     * single reviewer can approve).
     */
    approvalThreshold?: number;
    /**
     * People/Teams assigned to the Task.
     */
    assignees?: Assignees;
    /**
     * Optional label describing how assignees are derived for the stage.
     */
    assigneeStrategy?: string;
    /**
     * Auto-fires from either a relative ISO 8601 duration variable or an absolute ISO 8601 date
     * variable. The boundary timer interrupts the user task and exits the subprocess with the
     * configured transitionId as the node's result, so an outgoing edge with that condition
     * routes the workflow downstream (e.g. to auto-revoke or auto-close).
     */
    expiryTimer?: ExpiryTimer;
    /**
     * Number of reviewers that must reject for the task to be rejected. Default is 1 (any
     * single reviewer can reject). This allows for scenarios where you want multiple approvals
     * but a single rejection can veto.
     */
    rejectionThreshold?: number;
    /**
     * Human-readable stage label shown to task assignees.
     */
    stageDisplayName?: string;
    /**
     * Workflow stage identifier stored on the task while this user task is active.
     */
    stageId?: string;
    /**
     * Coarse task status mapped while this user task is active.
     */
    taskStatus?: TaskStatus;
    /**
     * Transitions available from this stage. Edge conditions should match these transition ids.
     */
    transitionMetadata?: TransitionMetadatum[];
    /**
     * When set, forces the accessType sent to the Policy Agent for every asset, overriding the
     * value on the Data Access Request payload. Set to 'Revoke' to tear down previously granted
     * access (the connector emits REVOKE instead of GRANT); on revoke the connector strips
     * whatever the principal holds on the scope (a revoke takes back everything, not a specific
     * level) — requestedAccess on the payload is preserved for audit/UI display but is not used
     * to decide what to tear down. When unset, the agent uses the accessType from the request
     * payload.
     */
    accessType?: AccessType;
    /**
     * Maximum seconds to wait for the Policy Agent pipeline to complete.
     *
     * Seconds to wait before treating the run as timed out.
     */
    timeoutSeconds?: number;
    /**
     * If true, waits for the Policy Agent ingestion pipeline to finish before continuing.
     *
     * Set if this step should wait until the Automation run finishes.
     */
    waitForCompletion?: boolean;
    /**
     * If True, it will be created/updated and run. Otherwise it will only be created/updated.
     */
    shouldRun?: boolean;
    /**
     * Name of the seed AI Automation template to instantiate per service (e.g.
     * DescriptionAutomation).
     */
    template?:      string;
    appliesWhen?:   string;
    candidates?:    EntityReference[];
    example?:       string;
    field?:         string;
    guidance?:      string;
    stage?:         EntityStatus;
    taskAssignees?: TaskAssigneesEnum;
}

/**
 * When set, forces the accessType sent to the Policy Agent for every asset, overriding the
 * value on the Data Access Request payload. Set to 'Revoke' to tear down previously granted
 * access (the connector emits REVOKE instead of GRANT); on revoke the connector strips
 * whatever the principal holds on the scope (a revoke takes back everything, not a specific
 * level) — requestedAccess on the payload is preserved for audit/UI display but is not used
 * to decide what to tear down. When unset, the agent uses the accessType from the request
 * payload.
 *
 * Access operation the Policy Agent should perform. Grant variants — FullAccess (all
 * columns), ColumnLevel (restricted to the columns listed in 'columns'), Masked
 * (anonymized/masked columns) — grant privileges at the given scope. Revoke tears down
 * whatever the principal currently holds at the scope (a revoke takes back everything, not
 * a specific level).
 */
export enum AccessType {
    ColumnLevel = "ColumnLevel",
    FullAccess = "FullAccess",
    Masked = "Masked",
    Revoke = "Revoke",
}

/**
 * People/Teams assigned to the Task.
 */
export interface Assignees {
    /**
     * Resolve owners from the asset’s domains at execution time. For a domain, use its own
     * owners.
     */
    addDomainOwners?: boolean;
    /**
     * Add the Owners to the assignees List.
     */
    addOwners?: boolean;
    /**
     * Add the Reviewers to the assignees List.
     */
    addReviewers?: boolean;
    /**
     * List of specific candidates (users or teams) assigned to this task.
     */
    candidates?: EntityReference[];
    /**
     * Strategy applied when no reviewers, owners, or candidates resolve to assignees. 'none'
     * keeps the default behavior (the gateway auto-approves event-driven approvals and leaves
     * workflow-managed tasks unassigned); 'assignAdmins' falls back to all platform admins,
     * excluding the requester so self-approval can never happen. 'wait' creates an unassigned
     * task when no eligible assignee is available, without auto-approval or an admin fallback.
     */
    emptyAssigneeStrategy?: EmptyAssigneeStrategy;
}

/**
 * Strategy applied when no reviewers, owners, or candidates resolve to assignees. 'none'
 * keeps the default behavior (the gateway auto-approves event-driven approvals and leaves
 * workflow-managed tasks unassigned); 'assignAdmins' falls back to all platform admins,
 * excluding the requester so self-approval can never happen. 'wait' creates an unassigned
 * task when no eligible assignee is available, without auto-approval or an admin fallback.
 */
export enum EmptyAssigneeStrategy {
    AssignAdmins = "assignAdmins",
    None = "none",
    Wait = "wait",
}

/**
 * Auto-fires from either a relative ISO 8601 duration variable or an absolute ISO 8601 date
 * variable. The boundary timer interrupts the user task and exits the subprocess with the
 * configured transitionId as the node's result, so an outgoing edge with that condition
 * routes the workflow downstream (e.g. to auto-revoke or auto-close).
 */
export interface ExpiryTimer {
    /**
     * When set, the underlying Task entity is closed at the moment the timer fires with this
     * resolutionType (the final taskStatus is derived from it by TaskRepository — Expired maps
     * to Expired; TimedOut maps to Failed). Leave unset when a downstream node is responsible
     * for closing the Task (avoids double-resolve).
     */
    closeAsResolution?: ResolutionType;
    /**
     * Name of the process variable holding the absolute ISO 8601 date/time when the timer
     * should fire (e.g. 'accessExpirationDate' → '2026-12-31T23:59:59Z').
     */
    dateVariable?: string;
    /**
     * Name of the process variable holding the ISO 8601 duration (e.g. 'accessDuration' →
     * 'P14D').
     */
    durationVariable?: string;
    /**
     * Result value emitted when the timer fires. Must match an outgoing edge condition from
     * this node.
     */
    transitionId: string;
}

/**
 * When set, the underlying Task entity is closed at the moment the timer fires with this
 * resolutionType (the final taskStatus is derived from it by TaskRepository — Expired maps
 * to Expired; TimedOut maps to Failed). Leave unset when a downstream node is responsible
 * for closing the Task (avoids double-resolve).
 *
 * How the task was resolved.
 */
export enum ResolutionType {
    Approved = "Approved",
    AutoApproved = "AutoApproved",
    AutoRejected = "AutoRejected",
    Cancelled = "Cancelled",
    Completed = "Completed",
    Expired = "Expired",
    Rejected = "Rejected",
    Revoked = "Revoked",
    TimedOut = "TimedOut",
}

export interface QualityBand {
    /**
     * Minimum completeness percentage for this band
     */
    minimumScore: number;
    /**
     * Name for this quality band (e.g., 'gold', 'excellent', 'tier1')
     */
    name: string;
}

/**
 * Coarse task status mapped while this user task is active.
 *
 * Current status of the task in its lifecycle.
 */
export enum TaskStatus {
    Approved = "Approved",
    Cancelled = "Cancelled",
    Completed = "Completed",
    Expired = "Expired",
    Failed = "Failed",
    Granted = "Granted",
    InProgress = "InProgress",
    ManualRevoke = "ManualRevoke",
    Open = "Open",
    Pending = "Pending",
    Rejected = "Rejected",
    Revoked = "Revoked",
}

export interface TransitionMetadatum {
    formRef?:         string;
    id:               string;
    label:            string;
    requiresComment?: boolean;
    resolutionType?:  ResolutionType;
    targetStageId:    string;
    targetTaskStatus: TaskStatus;
}

export interface InputNamespaceMap {
    relatedEntity: string;
    updatedBy?:    string;
}

/**
 * Event Based Entity Trigger.
 *
 * Periodic Batch Entity Trigger.
 */
export interface EntityTriggerDefinition {
    config?: TriggerConfiguration;
    output?: string[];
    type?:   string;
}

/**
 * Entity Event Trigger Configuration.
 */
export interface TriggerConfiguration {
    /**
     * Deprecated: Single entity type for which workflow should be triggered. Use 'entityTypes'
     * for multiple types.
     */
    entityType?: string;
    /**
     * Array of Entity Types for which this workflow should be triggered. Supports multiple
     * entity types in one workflow.
     */
    entityTypes?: string[];
    /**
     * Select the events that should trigger this workflow
     */
    events?: Event[];
    /**
     * Select fields that should not trigger the workflow if only them are modified.
     */
    exclude?: string[];
    /**
     * JSON Logic expression to determine if the workflow should be triggered. Can be a string
     * (applied to all entity types) or an object mapping entity types to their specific filters.
     */
    filter?: FilterConditionObject | string;
    /**
     * Array of field names that must be present in the change description to trigger the
     * workflow. Takes priority over exclude fields.
     */
    include?: string[];
    /**
     * Number of Entities to process at once.
     */
    batchSize?: number;
    /**
     * Search filters for entities. Can be a string (applied to all entity types) or an object
     * mapping entity types to their specific filters.
     */
    filters?: FiltersObject | string;
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

/**
 * Entity-specific filters with optional default
 */
export interface FilterConditionObject {
    /**
     * Default filter for entity types not explicitly configured
     */
    default?: string;
    [property: string]: string;
}

/**
 * Entity-specific filters with optional default
 */
export interface FiltersObject {
    /**
     * Default filter for entity types not explicitly configured
     */
    default?: string;
    [property: string]: string;
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
    Daily = "Daily",
    Hourly = "Hourly",
    Monthly = "Monthly",
    None = "None",
    Weekly = "Weekly",
}

export enum Type {
    EventBasedEntity = "eventBasedEntity",
    NoOp = "noOp",
    PeriodicBatchEntity = "periodicBatchEntity",
}
