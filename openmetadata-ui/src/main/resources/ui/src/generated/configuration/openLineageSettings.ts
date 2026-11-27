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
 * Settings for OpenLineage HTTP API integration. Configure how OpenMetadata receives and
 * processes lineage events from external systems like Spark, Airflow, and Flink.
 */
export interface OpenLineageSettings {
    /**
     * Create a Table that an OpenLineage event references but OpenMetadata lacks, along with
     * its missing Database and Database Schema, when the dataset namespace maps to a Database
     * Service through namespaceToServiceMapping and the event carries the table's columns in
     * its schema facet. Pipelines are never created.
     */
    autoCreateEntities?: boolean;
    /**
     * Name of the Pipeline Service searched for the Pipeline of an OpenLineage job, named
     * '<namespace>-<job name>'. Pipelines are never created from OpenLineage events; a job
     * without one is reported in the response and its edges carry no pipeline.
     */
    defaultPipelineService?: string;
    /**
     * Enable or disable the OpenLineage HTTP API endpoint.
     */
    enabled?: boolean;
    /**
     * List of OpenLineage event types to process. Only events matching these types will create
     * lineage. Default is to only process COMPLETE events.
     */
    eventTypeFilter?: EventTypeFilter[];
    /**
     * Mapping of OpenLineage dataset namespaces to OpenMetadata Database Service names, matched
     * exactly and then by the longest namespace prefix. Used to resolve dataset references to
     * existing tables, and the only way a missing table can be created (see
     * autoCreateEntities). Example: 'postgresql://prod-db:5432' -> 'prod-postgres'
     */
    namespaceToServiceMapping?: { [key: string]: string };
    /**
     * Set how owners from OpenLineage job ownership facets update Pipeline owners. In replace
     * mode, resolved owners from the current event replace existing owners. In append mode,
     * resolved owners are appended to active existing Pipeline owners.
     */
    ownershipUpdateMode?: OwnershipUpdateMode;
}

export enum EventTypeFilter {
    Abort = "ABORT",
    Complete = "COMPLETE",
    Fail = "FAIL",
    Other = "OTHER",
    Running = "RUNNING",
    Start = "START",
}

/**
 * Set how owners from OpenLineage job ownership facets update Pipeline owners. In replace
 * mode, resolved owners from the current event replace existing owners. In append mode,
 * resolved owners are appended to active existing Pipeline owners.
 */
export enum OwnershipUpdateMode {
    Append = "append",
    Replace = "replace",
}
