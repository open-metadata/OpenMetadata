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
 * This schema defines the Report entity. `Reports` are static information computed from
 * data periodically that includes data in text, table, and visual form.
 */
export interface Report {
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of this report instance.
     */
    description?: string;
    /**
     * Display Name that identifies this report. It could be title or label from the source
     * services.
     */
    displayName?: string;
    /**
     * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
     * it belongs to.
     */
    domains?: EntityReference[];
    /**
     * A unique name that identifies a report in the format 'ServiceName.ReportName'.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this report.
     */
    href?: string;
    /**
     * Unique identifier that identifies this report.
     */
    id: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Name that identifies this report instance uniquely.
     */
    name: string;
    /**
     * Owners of this Report.
     */
    owners?: EntityReference[];
    /**
     * Link to service where this report is hosted in.
     */
    service: EntityReference;
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
     * Latest usage information for this database.
     */
    usageSummary?: UsageDetails;
    /**
     * Metadata version of the entity.
     */
    version?: number;
    /**
     * Votes on the entity.
     */
    votes?: Votes;
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
 * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
 * it belongs to.
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
 *
 * Link to service where this report is hosted in.
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
 * Latest usage information for this database.
 *
 * This schema defines the type for usage details. Daily, weekly, and monthly aggregation of
 * usage is computed along with the percentile rank based on the usage for a given day.
 */
export interface UsageDetails {
    /**
     * Daily usage stats of a data asset on the start date.
     */
    dailyStats: UsageStats;
    /**
     * Date in UTC.
     */
    date: Date;
    /**
     * Monthly (last 30 days) rolling usage stats of a data asset on the start date.
     */
    monthlyStats?: UsageStats;
    /**
     * Weekly (last 7 days) rolling usage stats of a data asset on the start date.
     */
    weeklyStats?: UsageStats;
}

/**
 * Daily usage stats of a data asset on the start date.
 *
 * Type used to return usage statistics.
 *
 * Monthly (last 30 days) rolling usage stats of a data asset on the start date.
 *
 * Weekly (last 7 days) rolling usage stats of a data asset on the start date.
 */
export interface UsageStats {
    /**
     * Usage count of a data asset on the start date.
     */
    count: number;
    /**
     * Optional daily percentile rank data asset use when relevant.
     */
    percentileRank?: number;
}

/**
 * Votes on the entity.
 *
 * This schema defines the Votes for a Data Asset.
 */
export interface Votes {
    /**
     * List of all the Users who downVoted
     */
    downVoters?: EntityReference[];
    /**
     * Total down-votes the entity has
     */
    downVotes?: number;
    /**
     * List of all the Users who upVoted
     */
    upVoters?: EntityReference[];
    /**
     * Total up-votes the entity has
     */
    upVotes?: number;
}
