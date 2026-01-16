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
 * Query Runner Request
 */
export interface QueryRunnerRequest {
    /**
     * Authentication type configured by admin in QueryRunnerConfig (e.g., Basic, ExternalOAuth,
     * etc.). Used to determine which credential field to use from user config.
     */
    authType?: string;
    /**
     * Type of the connection to test such as Snowflake, MySQL, Looker, etc.
     */
    connectionType?: string;
    /**
     * Optional database/dataset to use for query execution (selected by user in QueryRunner
     * Studio). Service-specific name (e.g., Snowflake database).
     */
    database?: string;
    /**
     * Optional database schema to use for query execution (selected by user in QueryRunner
     * Studio). Service-specific name (e.g., Snowflake schema). Named 'databaseSchema' instead
     * of 'schema' to avoid conflicts with Pydantic's BaseModel.schema() method.
     */
    databaseSchema?: string;
    /**
     * Query to be executed.
     */
    query?: string;
    /**
     * Optional role to use for query execution (selected by user in QueryRunner Studio).
     * Service-specific (e.g., Snowflake role).
     */
    role?: string;
    /**
     * Optional value that identifies this service name.
     */
    serviceName?: string;
    /**
     * Optional value to indicate if the query should be transpiled.
     */
    transpile?: boolean;
    /**
     * UUID of the user's QueryRunner config for this specific service (looked up by backend
     * using userId + serviceName)
     */
    userConfigId?: string;
    /**
     * UUID of the user executing the query (extracted from JWT token in backend)
     */
    userId?: string;
    /**
     * Optional value of the workflow name responsible for running the test
     */
    workflowName?: string;
}
