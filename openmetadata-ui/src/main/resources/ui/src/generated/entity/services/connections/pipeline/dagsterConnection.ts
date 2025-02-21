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
 * Dagster Metadata Database Connection Config
 */
export interface DagsterConnection {
    /**
     * URL to the Dagster instance
     */
    host:                        string;
    supportsMetadataExtraction?: boolean;
    /**
     * Connection Time Limit Between OM and Dagster Graphql API in second
     */
    timeout?: number;
    /**
     * To Connect to Dagster Cloud
     */
    token?: string;
    /**
     * Service Type
     */
    type?: DagsterType;
}

/**
 * Service Type
 *
 * Service type.
 */
export enum DagsterType {
    Dagster = "Dagster",
}
