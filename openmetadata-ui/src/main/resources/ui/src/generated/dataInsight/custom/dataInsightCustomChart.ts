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
 * DI Chart Entity
 */
export interface DataInsightCustomChart {
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    chartDetails:       LineChart;
    /**
     * Type of chart, used for UI to render the chart
     */
    chartType?: ChartType;
    /**
     * Dashboard where this chart is displayed
     */
    dashboard?: EntityReference;
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of the data insight chart.
     */
    description?: string;
    /**
     * Display Name the data insight chart.
     */
    displayName?: string;
    /**
     * FullyQualifiedName same as `name`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    /**
     * Unique identifier of this table instance.
     */
    id?: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Flag to indicate if the chart is system generated or user created.
     */
    isSystemChart?: boolean;
    /**
     * Name that identifies this data insight chart.
     */
    name: string;
    /**
     * Owner of this chart
     */
    owner?: EntityReference;
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
 * Line Chart
 *
 * Summary Card
 */
export interface LineChart {
    /**
     * List of groups to be excluded in the data insight chart when groupBy is specified.
     */
    excludeGroups?: string[];
    /**
     * Regex to exclude fields from the data insight chart when xAxisField is specified.
     */
    excludeXAxisField?: string;
    /**
     * Breakdown field for the data insight chart.
     */
    groupBy?: string;
    /**
     * List of groups to be included in the data insight chart when groupBy is specified.
     */
    includeGroups?: string[];
    /**
     * Regex to include fields in the data insight chart when xAxisField is specified.
     */
    includeXAxisFiled?: string;
    kpiDetails?:        KpiDetails;
    /**
     * Metrics for the data insight chart.
     */
    metrics?: Metrics[];
    /**
     * Search index for the data insight chart.
     */
    searchIndex?: string;
    /**
     * Type of the data insight chart.
     */
    type?: Type;
    /**
     * X-axis field for the data insight chart.
     */
    xAxisField?: string;
    /**
     * X-axis label for the data insight chart.
     */
    xAxisLabel?: string;
    /**
     * Y-axis label for the data insight chart.
     */
    yAxisLabel?: string;
}

/**
 * KPI details for the data insight chart.
 */
export interface KpiDetails {
    /**
     * End Date of KPI
     */
    endDate?: string;
    /**
     * Start Date of KPI
     */
    startDate?: string;
    /**
     * Target value of KPI
     */
    target?: number;
    [property: string]: any;
}

export interface Metrics {
    /**
     * Filter field for the data insight chart.
     */
    field?: string;
    /**
     * Filter value for the data insight chart.
     */
    filter?: string;
    /**
     * Formula for the data insight chart calculation.
     */
    formula?:  string;
    function?: Function;
    /**
     * Name of the metric for the data insight chart.
     */
    name?: string;
    /**
     * Tree filter value for the data insight chart. Needed for UI to recreate advance filter
     * tree.
     */
    treeFilter?: string;
    [property: string]: any;
}

/**
 * aggregation function for chart
 */
export enum Function {
    Avg = "avg",
    Count = "count",
    Max = "max",
    Min = "min",
    Sum = "sum",
    Unique = "unique",
}

/**
 * Type of the data insight chart.
 */
export enum Type {
    LineChart = "LineChart",
    SummaryCard = "SummaryCard",
}

/**
 * Type of chart, used for UI to render the chart
 */
export enum ChartType {
    AreaChart = "AreaChart",
    BarChart = "BarChart",
    LineChart = "LineChart",
    SummaryCard = "SummaryCard",
}

/**
 * Dashboard where this chart is displayed
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owner of this chart
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
