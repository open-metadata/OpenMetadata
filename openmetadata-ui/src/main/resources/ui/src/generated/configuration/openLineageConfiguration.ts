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
 * Configuration for OpenLineage HTTP API integration.
 */
export interface OpenLineageConfiguration {
    /**
     * Automatically create Table and Pipeline entities when they are referenced in OpenLineage
     * events but don't exist in OpenMetadata.
     */
    autoCreateEntities?: boolean;
    /**
     * Name of the Pipeline Service to use when auto-creating Pipeline entities from OpenLineage
     * jobs. This service must exist in OpenMetadata.
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
     * Mapping of OpenLineage dataset namespaces to OpenMetadata Database Service names. Used to
     * resolve dataset references to existing tables.
     */
    namespaceToServiceMapping?: { [key: string]: string };
}

export enum EventTypeFilter {
    Abort = "ABORT",
    Complete = "COMPLETE",
    Fail = "FAIL",
    Other = "OTHER",
    Running = "RUNNING",
    Start = "START",
}
