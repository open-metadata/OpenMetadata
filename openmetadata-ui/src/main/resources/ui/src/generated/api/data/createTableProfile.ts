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
 * Schema corresponding to a table profile that belongs to a table
 */
export interface CreateTableProfile {
    /**
     * List of local column profiles of the table.
     */
    columnProfile?: ColumnProfile[];
    /**
     * List of system profiles for the table.
     */
    systemProfile?: SystemProfile[];
    /**
     * Table Profile.
     */
    tableProfile: TableProfile;
}

/**
 * This schema defines the type to capture the table's column profile.
 */
export interface ColumnProfile {
    /**
     * Cardinality distribution showing top categories with an 'Others' bucket.
     */
    cardinalityDistribution?: CardinalityDistribution;
    /**
     * Custom Metrics profile list bound to a column.
     */
    customMetrics?: CustomMetricProfile[];
    /**
     * Number of values that contain distinct values.
     */
    distinctCount?: number;
    /**
     * Proportion of distinct values in a column.
     */
    distinctProportion?: number;
    /**
     * No.of Rows that contain duplicates in a column.
     */
    duplicateCount?: number;
    /**
     * First quartile of a column.
     */
    firstQuartile?: number;
    /**
     * Histogram of a column.
     */
    histogram?: any[] | boolean | HistogramClass | number | number | null | string;
    /**
     * Inter quartile range of a column.
     */
    interQuartileRange?: number;
    /**
     * Maximum value in a column.
     */
    max?: number | string;
    /**
     * Maximum string length in a column.
     */
    maxLength?: number;
    /**
     * Avg value in a column.
     */
    mean?: number;
    /**
     * Median of a column.
     */
    median?: number;
    /**
     * Minimum value in a column.
     */
    min?: number | string;
    /**
     * Minimum string length in a column.
     */
    minLength?: number;
    /**
     * Missing count is calculated by subtracting valuesCount - validCount.
     */
    missingCount?: number;
    /**
     * Missing Percentage is calculated by taking percentage of validCount/valuesCount.
     */
    missingPercentage?: number;
    /**
     * Column Name.
     */
    name: string;
    /**
     * Non parametric skew of a column.
     */
    nonParametricSkew?: number;
    /**
     * No.of null values in a column.
     */
    nullCount?: number;
    /**
     * No.of null value proportion in columns.
     */
    nullProportion?: number;
    /**
     * Standard deviation of a column.
     */
    stddev?: number;
    /**
     * Median value in a column.
     */
    sum?: number;
    /**
     * First quartile of a column.
     */
    thirdQuartile?: number;
    /**
     * Timestamp on which profile is taken.
     */
    timestamp: number;
    /**
     * No. of unique values in the column.
     */
    uniqueCount?: number;
    /**
     * Proportion of number of unique values in a column.
     */
    uniqueProportion?: number;
    /**
     * Total count of valid values in this column.
     */
    validCount?: number;
    /**
     * Total count of the values in this column.
     */
    valuesCount?: number;
    /**
     * Percentage of values in this column with respect to row count.
     */
    valuesPercentage?: number;
    /**
     * Variance of a column.
     */
    variance?: number;
}

/**
 * Cardinality distribution showing top categories with an 'Others' bucket.
 */
export interface CardinalityDistribution {
    /**
     * List of category names including 'Others'.
     */
    categories?: string[];
    /**
     * List of counts corresponding to each category.
     */
    counts?: number[];
    /**
     * List of percentages corresponding to each category.
     */
    percentages?: number[];
}

/**
 * Profiling results of a Custom Metric.
 */
export interface CustomMetricProfile {
    /**
     * Custom metric name.
     */
    name?: string;
    /**
     * Profiling results for the metric.
     */
    value?: number;
}

export interface HistogramClass {
    /**
     * Boundaries of Histogram.
     */
    boundaries?: any[];
    /**
     * Frequencies of Histogram.
     */
    frequencies?: any[];
}

/**
 * This schema defines the System Profile object holding profile data from system tables.
 */
export interface SystemProfile {
    /**
     * Operation performed.
     */
    operation?: DMLOperationType;
    /**
     * Number of rows affected.
     */
    rowsAffected?: number;
    /**
     * Timestamp on which profile is taken.
     */
    timestamp?: number;
    [property: string]: any;
}

/**
 * Operation performed.
 *
 * This schema defines the type of DML operation.
 */
export enum DMLOperationType {
    Delete = "DELETE",
    Insert = "INSERT",
    Update = "UPDATE",
    Write = "WRITE",
}

/**
 * Table Profile.
 *
 * This schema defines the type to capture the table's data profile.
 */
export interface TableProfile {
    /**
     * No.of columns in the table.
     */
    columnCount?: number;
    /**
     * Table creation time.
     */
    createDateTime?: Date;
    /**
     * Custom Metrics profile list bound to a column.
     */
    customMetrics?: CustomMetricProfile[];
    /**
     * Percentage of data or no. of rows we want to execute the profiler and tests on
     */
    profileSample?:     number;
    profileSampleType?: ProfileSampleType;
    /**
     * No.of rows in the table. This is always executed on the whole table.
     */
    rowCount?:           number;
    samplingMethodType?: SamplingMethodType;
    /**
     * Table size in GB
     */
    sizeInByte?: number;
    /**
     * Timestamp on which profile is taken.
     */
    timestamp: number;
}

/**
 * Type of Profile Sample (percentage or rows)
 */
export enum ProfileSampleType {
    Percentage = "PERCENTAGE",
    Rows = "ROWS",
}

/**
 * Type of Sampling Method (BERNOULLI or SYSTEM)
 */
export enum SamplingMethodType {
    Bernoulli = "BERNOULLI",
    System = "SYSTEM",
}
