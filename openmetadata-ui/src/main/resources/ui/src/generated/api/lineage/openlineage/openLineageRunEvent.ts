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
 * OpenLineage RunEvent representing a job execution with its inputs and outputs.
 */
export interface OpenLineageRunEvent {
    /**
     * The time the event occurred, in ISO 8601 format (UTC).
     */
    eventTime: Date;
    /**
     * The lifecycle state of the run.
     */
    eventType?: EventType;
    /**
     * Input datasets consumed by this run.
     */
    inputs?: OpenLineageInputDataset[];
    /**
     * The job that executed this run.
     */
    job: OpenLineageJob;
    /**
     * Output datasets produced by this run.
     */
    outputs?: OpenLineageOutputDataset[];
    /**
     * URI identifying the producer of this metadata.
     */
    producer: string;
    /**
     * The run this event is about.
     */
    run: OpenLineageRun;
    /**
     * URI pointing to the OpenLineage schema version.
     */
    schemaURL: string;
}

/**
 * The lifecycle state of the run.
 *
 * The type of lifecycle event.
 */
export enum EventType {
    Abort = "ABORT",
    Complete = "COMPLETE",
    Fail = "FAIL",
    Other = "OTHER",
    Running = "RUNNING",
    Start = "START",
}

/**
 * Input dataset consumed by a job.
 *
 * Base dataset definition.
 */
export interface OpenLineageInputDataset {
    /**
     * Dataset facets containing metadata like schema.
     */
    facets?: DatasetFacets;
    /**
     * Input-specific facets.
     */
    inputFacets?: { [key: string]: any };
    /**
     * The name of the dataset (e.g., 'schema.table').
     */
    name: string;
    /**
     * The namespace of the dataset (e.g., 'postgres://host:5432/database').
     */
    namespace: string;
    [property: string]: any;
}

/**
 * Common facets that can be attached to a dataset.
 *
 * Dataset facets containing metadata like schema.
 */
export interface DatasetFacets {
    datasource?:    DatasourceFacet;
    documentation?: DocumentationFacet;
    ownership?:     OwnershipFacet;
    schema?:        SchemaFacet;
    symlinks?:      SymlinksFacet;
    [property: string]: any;
}

/**
 * Datasource facet providing connection details for the dataset.
 *
 * Base facet that all facets extend from.
 */
export interface DatasourceFacet {
    /**
     * URI identifying the producer of this metadata.
     */
    _producer?: string;
    /**
     * URI pointing to the schema definition for this facet.
     */
    _schemaURL?: string;
    /**
     * The name of the datasource.
     */
    name?: string;
    /**
     * The URI of the datasource (e.g., postgres://host:5432/db).
     */
    uri?: string;
    [property: string]: any;
}

/**
 * Documentation facet providing description for the dataset.
 *
 * Base facet that all facets extend from.
 */
export interface DocumentationFacet {
    /**
     * URI identifying the producer of this metadata.
     */
    _producer?: string;
    /**
     * URI pointing to the schema definition for this facet.
     */
    _schemaURL?: string;
    /**
     * The documentation/description of the dataset.
     */
    description?: string;
    [property: string]: any;
}

/**
 * Ownership facet providing owner information for the dataset.
 *
 * Base facet that all facets extend from.
 */
export interface OwnershipFacet {
    /**
     * URI identifying the producer of this metadata.
     */
    _producer?: string;
    /**
     * URI pointing to the schema definition for this facet.
     */
    _schemaURL?: string;
    /**
     * List of owners.
     */
    owners?: Owner[];
    [property: string]: any;
}

export interface Owner {
    /**
     * The name of the owner.
     */
    name: string;
    /**
     * The type of owner (e.g., MAINTAINER, DATAOWNER).
     */
    type?: string;
    [property: string]: any;
}

/**
 * Schema facet describing the structure of a dataset.
 *
 * Base facet that all facets extend from.
 */
export interface SchemaFacet {
    /**
     * URI identifying the producer of this metadata.
     */
    _producer?: string;
    /**
     * URI pointing to the schema definition for this facet.
     */
    _schemaURL?: string;
    /**
     * List of fields in the schema.
     */
    fields?: SchemaField[];
    [property: string]: any;
}

/**
 * A field in a dataset schema.
 */
export interface SchemaField {
    /**
     * Optional description of the field.
     */
    description?: string;
    /**
     * The name of the field.
     */
    name: string;
    /**
     * The type of the field (e.g., STRING, INTEGER, STRUCT).
     */
    type: string;
    [property: string]: any;
}

/**
 * Symlinks facet providing alternate identifiers for a dataset.
 *
 * Base facet that all facets extend from.
 */
export interface SymlinksFacet {
    /**
     * URI identifying the producer of this metadata.
     */
    _producer?: string;
    /**
     * URI pointing to the schema definition for this facet.
     */
    _schemaURL?: string;
    /**
     * List of alternate identifiers.
     */
    identifiers?: SymlinkIdentifier[];
    [property: string]: any;
}

/**
 * An alternate identifier for a dataset.
 */
export interface SymlinkIdentifier {
    /**
     * The name of the symlink.
     */
    name: string;
    /**
     * The namespace of the symlink.
     */
    namespace: string;
    /**
     * The type of symlink (e.g., TABLE).
     */
    type: string;
    [property: string]: any;
}

/**
 * The job that executed this run.
 *
 * Job information including namespace and name.
 */
export interface OpenLineageJob {
    /**
     * Job facets containing metadata like SQL.
     */
    facets?: JobFacets;
    /**
     * The name of the job.
     */
    name: string;
    /**
     * The namespace of the job (e.g., 'airflow', 'spark').
     */
    namespace: string;
    [property: string]: any;
}

/**
 * Job facets containing metadata like SQL.
 *
 * Facets that can be attached to a job.
 */
export interface JobFacets {
    sql?: SQLJobFacet;
    [property: string]: any;
}

/**
 * SQL job facet containing the SQL query.
 *
 * Base facet that all facets extend from.
 */
export interface SQLJobFacet {
    /**
     * URI identifying the producer of this metadata.
     */
    _producer?: string;
    /**
     * URI pointing to the schema definition for this facet.
     */
    _schemaURL?: string;
    /**
     * The SQL query executed by the job.
     */
    query: string;
    [property: string]: any;
}

/**
 * Output dataset produced by a job.
 *
 * Base dataset definition.
 */
export interface OpenLineageOutputDataset {
    /**
     * Dataset facets containing metadata like schema.
     */
    facets?: DatasetFacets;
    /**
     * The name of the dataset (e.g., 'schema.table').
     */
    name: string;
    /**
     * The namespace of the dataset (e.g., 'postgres://host:5432/database').
     */
    namespace: string;
    /**
     * Output-specific facets including column lineage.
     */
    outputFacets?: OutputDatasetFacets;
    [property: string]: any;
}

/**
 * Output-specific facets including column lineage.
 *
 * Facets specific to output datasets.
 */
export interface OutputDatasetFacets {
    columnLineage?: ColumnLineageFacet;
    [property: string]: any;
}

/**
 * Column lineage facet describing how output columns are derived from input columns.
 *
 * Base facet that all facets extend from.
 */
export interface ColumnLineageFacet {
    /**
     * URI identifying the producer of this metadata.
     */
    _producer?: string;
    /**
     * URI pointing to the schema definition for this facet.
     */
    _schemaURL?: string;
    /**
     * Map of output field names to their lineage information.
     */
    fields: { [key: string]: ColumnLineageField };
    [property: string]: any;
}

/**
 * Column lineage information for a single output field.
 */
export interface ColumnLineageField {
    /**
     * List of input fields that contribute to this output field.
     */
    inputFields: InputField[];
    /**
     * Human-readable description of the transformation.
     */
    transformationDescription?: string;
    /**
     * Type of transformation (e.g., DIRECT, AGGREGATION).
     */
    transformationType?: string;
    [property: string]: any;
}

/**
 * A reference to an input column in column lineage.
 */
export interface InputField {
    /**
     * The name of the input field/column.
     */
    field: string;
    /**
     * The name of the input dataset.
     */
    name: string;
    /**
     * The namespace of the input dataset.
     */
    namespace: string;
    [property: string]: any;
}

/**
 * The run this event is about.
 *
 * Run information including run ID and facets.
 */
export interface OpenLineageRun {
    /**
     * Run facets containing metadata like parent run.
     */
    facets?: RunFacets;
    /**
     * Globally unique identifier for this run.
     */
    runId: string;
    [property: string]: any;
}

/**
 * Run facets containing metadata like parent run.
 *
 * Facets that can be attached to a run.
 */
export interface RunFacets {
    errorMessage?:      ErrorMessageFacet;
    parent?:            ParentRunFacet;
    processing_engine?: ProcessingEngineFacet;
    [property: string]: any;
}

/**
 * Error message facet for capturing run failures.
 *
 * Base facet that all facets extend from.
 */
export interface ErrorMessageFacet {
    /**
     * URI identifying the producer of this metadata.
     */
    _producer?: string;
    /**
     * URI pointing to the schema definition for this facet.
     */
    _schemaURL?: string;
    /**
     * The error message.
     */
    message: string;
    /**
     * The programming language of the stack trace.
     */
    programmingLanguage?: string;
    /**
     * The stack trace of the error.
     */
    stackTrace?: string;
    [property: string]: any;
}

/**
 * Parent run facet linking a run to its parent job.
 *
 * Base facet that all facets extend from.
 */
export interface ParentRunFacet {
    /**
     * URI identifying the producer of this metadata.
     */
    _producer?: string;
    /**
     * URI pointing to the schema definition for this facet.
     */
    _schemaURL?: string;
    /**
     * The parent job information.
     */
    job: ParentJobFacet;
    /**
     * The parent run information.
     */
    run?: Run;
    [property: string]: any;
}

/**
 * The parent job information.
 *
 * Parent job information in run facets.
 */
export interface ParentJobFacet {
    /**
     * The name of the parent job.
     */
    name: string;
    /**
     * The namespace of the parent job.
     */
    namespace: string;
    [property: string]: any;
}

/**
 * The parent run information.
 */
export interface Run {
    /**
     * The UUID of the parent run.
     */
    runId: string;
    [property: string]: any;
}

/**
 * Processing engine facet describing the execution environment.
 *
 * Base facet that all facets extend from.
 */
export interface ProcessingEngineFacet {
    /**
     * URI identifying the producer of this metadata.
     */
    _producer?: string;
    /**
     * URI pointing to the schema definition for this facet.
     */
    _schemaURL?: string;
    /**
     * The name of the processing engine (e.g., Spark, Flink).
     */
    name?: string;
    /**
     * Version of the OpenLineage adapter.
     */
    openlineageAdapterVersion?: string;
    /**
     * The version of the processing engine.
     */
    version?: string;
    [property: string]: any;
}
