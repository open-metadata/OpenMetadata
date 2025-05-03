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
 * Line Chart
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
}
