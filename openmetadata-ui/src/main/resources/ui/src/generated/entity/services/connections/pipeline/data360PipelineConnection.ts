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
 * Salesforce Data 360 Pipeline Connection Config
 */
export interface Data360PipelineConnection {
    /**
     * Consumer key provided when you setup your Salesforce connected app
     */
    consumerKey: string;
    /**
     * Consumer secret provided when you setup your Salesforce connected app
     */
    consumerSecret: string;
    /**
     * Name of the Data 360 database service to use for lineage resolution
     */
    data360DbServiceName?: string;
    /**
     * Pagination limit used when fetching Data 360 objects. The default value is 10, and the
     * valid range is 1-200
     */
    paginationLimit?: number;
    /**
     * API version of the Salesforce instance
     */
    salesforceApiVersion?: string;
    /**
     * Domain of Salesforce instance
     */
    salesforceDomain?:           string;
    supportsLineageExtraction?:  boolean;
    supportsMetadataExtraction?: boolean;
    supportsUsageExtraction?:    boolean;
    /**
     * Service Type
     */
    type?: Data360PipelineType;
}

/**
 * Service Type
 *
 * Service type.
 */
export enum Data360PipelineType {
    Data360Pipeline = "Data360Pipeline",
}
