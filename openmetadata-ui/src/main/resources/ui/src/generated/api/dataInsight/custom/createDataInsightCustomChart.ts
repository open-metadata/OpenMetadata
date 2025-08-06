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
 * Payload to create a data insight custom chart
 */
export interface CreateDataInsightCustomChart {
    chartDetails: LineChart;
    /**
     * Type of chart, used for UI to render the chart
     */
    chartType?: ChartType;
    /**
     * Dashboard where this chart is displayed
     */
    dashboard?: EntityReference;
    /**
     * Description of the data insight chart.
     */
    description?: string;
    /**
     * Display Name the data insight chart.
     */
    displayName?: string;
    /**
     * Name that identifies this data insight chart.
     */
    name: string;
    /**
     * Owner of this chart
     */
    owner?: EntityReference;
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
