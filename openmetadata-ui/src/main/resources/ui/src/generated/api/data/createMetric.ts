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
 * Create Metric entity request
 */
export interface CreateMetric {
    /**
     * List of fully qualified names of data products this entity is part of.
     */
    dataProducts?: string[];
    /**
     * Description of the metric instance.
     */
    description?: string;
    /**
     * Display Name that identifies this metric.
     */
    displayName?: string;
    /**
     * Fully qualified names of the domains the Metric belongs to.
     */
    domains?: string[];
    /**
     * Entity extension data with custom attributes added to the entity.
     */
    extension?: any;
    /**
     * Metric's granularity.
     */
    granularity?: MetricGranularity;
    /**
     * Expression used to compute the metric.
     */
    metricExpression?: MetricExpression;
    /**
     * Type of the metric.
     */
    metricType?: MetricType;
    /**
     * Name that identifies this metric.
     */
    name: string;
    /**
     * Owners of this metric
     */
    owners?: EntityReference[];
    /**
     * Other array of related metric fully qualified names that are related to this Metric.
     */
    relatedMetrics?: string[];
    /**
     * Tags for this metric
     */
    tags?: TagLabel[];
    /**
     * Unit of measurement for the metric.
     */
    unitOfMeasurement?: UnitOfMeasurement;
}

/**
 * Metric's granularity.
 *
 * This schema defines the type of Metric's granularity.
 */
export enum MetricGranularity {
    Day = "DAY",
    Hour = "HOUR",
    Minute = "MINUTE",
    Month = "MONTH",
    Quarter = "QUARTER",
    Second = "SECOND",
    Week = "WEEK",
    Year = "YEAR",
}

/**
 * Expression used to compute the metric.
 */
export interface MetricExpression {
    /**
     * This schema defines the type of the language used for Metric Formula's Code.
     */
    code?: string;
    /**
     * This schema defines the type of the language used for Metric Expression Code.
     */
    language?: Language;
}

/**
 * This schema defines the type of the language used for Metric Expression Code.
 */
export enum Language {
    External = "External",
    Java = "Java",
    JavaScript = "JavaScript",
    Python = "Python",
    SQL = "SQL",
}

/**
 * Type of the metric.
 *
 * This schema defines the type of Metric.
 */
export enum MetricType {
    Average = "AVERAGE",
    Count = "COUNT",
    Max = "MAX",
    Median = "MEDIAN",
    Min = "MIN",
    Mode = "MODE",
    Other = "OTHER",
    Percentage = "PERCENTAGE",
    Ratio = "RATIO",
    StandardDeviation = "STANDARD_DEVIATION",
    Sum = "SUM",
    Variance = "VARIANCE",
}

/**
 * Owners of this metric
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

/**
 * Unit of measurement for the metric.
 *
 * This schema defines the type of Metric's unit of measurement.
 */
export enum UnitOfMeasurement {
    Count = "COUNT",
    Dollars = "DOLLARS",
    Events = "EVENTS",
    Percentage = "PERCENTAGE",
    Requests = "REQUESTS",
    Size = "SIZE",
    Timestamp = "TIMESTAMP",
    Transactions = "TRANSACTIONS",
}
