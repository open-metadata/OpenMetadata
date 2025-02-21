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
 * No configuration needed to instantiate the Data Insights Pipeline. The logic is handled
 * in the backend.
 */
export interface DataInsightsAppConfig {
    backfillConfiguration?: BackfillConfiguration;
    /**
     * Maximum number of events processed at a time (Default 100).
     */
    batchSize?: number;
    /**
     * Recreates the DataAssets index on DataInsights. Useful if you changed a Custom Property
     * Type and are facing errors. Bear in mind that recreating the index will delete your
     * DataAssets and a backfill will be needed.
     */
    recreateDataAssetsIndex?: boolean;
    /**
     * Application Type
     */
    type?: DataInsightsAppType;
}

/**
 * Backfill Configuration
 */
export interface BackfillConfiguration {
    /**
     * Enable Backfill for the configured dates
     */
    enabled?: boolean;
    /**
     * Date for which the backfill will end
     */
    endDate?: Date;
    /**
     * Date from which to start the backfill
     */
    startDate?: Date;
    [property: string]: any;
}

/**
 * Application Type
 */
export enum DataInsightsAppType {
    DataInsights = "DataInsights",
}
