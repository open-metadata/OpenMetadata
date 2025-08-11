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
 * DatabaseService Query Usage Pipeline Configuration.
 */
export interface DatabaseServiceQueryUsagePipeline {
    /**
     * Configuration the condition to filter the query history.
     */
    filterCondition?: string;
    /**
     * Configuration to process query cost
     */
    processQueryCostAnalysis?: boolean;
    /**
     * Configuration to tune how far we want to look back in query logs to process usage data.
     */
    queryLogDuration?: number;
    /**
     * Configuration to set the file path for query logs
     */
    queryLogFilePath?: string;
    /**
     * Configuration to set the limit for query logs
     */
    resultLimit?: number;
    /**
     * Temporary file name to store the query logs before processing. Absolute file path
     * required.
     */
    stageFileLocation?: string;
    /**
     * Pipeline type
     */
    type?: DatabaseUsageConfigType;
}

/**
 * Pipeline type
 *
 * Database Source Config Usage Pipeline type
 */
export enum DatabaseUsageConfigType {
    DatabaseUsage = "DatabaseUsage",
}
