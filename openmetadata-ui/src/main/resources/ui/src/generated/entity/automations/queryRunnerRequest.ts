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
     * Type of the connection to test such as Snowflake, MySQL, Looker, etc.
     */
    connectionType?: string;
    /**
     * Optional value of the ingestion runner name responsible for running the test
     */
    ingestionRunner?: string;
    /**
     * Query to be executed.
     */
    query?: string;
    /**
     * Optional value that identifies this service name.
     */
    serviceName?: string;
    /**
     * Optional value to indicate if the query should be transpiled.
     */
    transpile?: boolean;
}
