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
 * Represents an uploaded asset record (e.g. an image, pdf or attachment) for an entity.
 */
export interface Asset {
    /**
     * Type of the asset.
     */
    assetType?: AssetType;
    /**
     * SHA-256 of the file's bytes, hex-encoded. Two uploads with the same checksum hold the
     * same file.
     */
    checksum?: string;
    /**
     * MIME type of the asset.
     */
    contentType?: string;
    /**
     * Structure and statistics of a tabular file, absent until the Query Runner has read it.
     */
    dataProfile?: TabularProfile;
    /**
     * When `true` indicates the entity has been marked for permanent deletion.
     */
    deleted?: boolean;
    /**
     * Link to the entity that this asset belongs to.
     */
    entityLink: string;
    /**
     * File extension of the asset.
     */
    extension?: string;
    /**
     * The original file name of the asset.
     */
    fileName: string;
    /**
     * Fully qualified name of a data asset the attachment belongsTo`.
     */
    fullyQualifiedName?: string;
    /**
     * Unique identifier of the asset.
     */
    id: string;
    /**
     * File size in bytes.
     */
    size?: number;
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
     * URL where the asset is accessible.
     */
    url?: string;
}

/**
 * Type of the asset.
 *
 * This schema defines the type used for describing different types of Attachments.
 */
export enum AssetType {
    External = "External",
    Inline = "Inline",
}

/**
 * Structure and statistics of a tabular file, absent until the Query Runner has read it.
 *
 * How the Query Runner reads a tabular file, taken once after the upload by the worker that
 * later queries it.
 */
export interface TabularProfile {
    /**
     * Why the file could not be read, when the read failed. A profile with an error has no
     * relations.
     */
    error?:     string;
    readAt?:    number;
    relations?: TabularRelation[];
}

/**
 * One relation the Query Runner registers from a tabular file: the file itself for a CSV,
 * one per sheet for a workbook.
 */
export interface TabularRelation {
    columns?: TabularColumn[];
    /**
     * Relation name, as registered for a file uploaded under its own name.
     */
    name: string;
    /**
     * Row and column counts of the relation, in the shape a table's profile has.
     */
    profile?: TableProfile;
}

/**
 * One column of a relation read from a tabular file.
 */
export interface TabularColumn {
    /**
     * The column's type as the engine that read the file names it, for example BIGINT or
     * VARCHAR.
     */
    dataType?: string;
    name:      string;
    /**
     * Statistics of the column's values, in the shape a table column's profile has. Filled as
     * far as the read goes: counts, null share, distinct count, min, max and mean, and for a
     * text column its most frequent values as the cardinality distribution (at most fifty, most
     * frequent first).
     */
    profile?: ColumnProfile;
}

/**
 * Statistics of the column's values, in the shape a table column's profile has. Filled as
 * far as the read goes: counts, null share, distinct count, min, max and mean, and for a
 * text column its most frequent values as the cardinality distribution (at most fifty, most
 * frequent first).
 *
 * This schema defines the type to capture the table's column profile.
 */
export interface ColumnProfile {
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
     * Flag indicating that all values in the column are unique, so no distribution is
     * calculated.
     */
    allValuesUnique?: boolean;
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
 * Row and column counts of the relation, in the shape a table's profile has.
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
    rowCount?: number;
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
