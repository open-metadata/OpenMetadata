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
 * This schema defines type of query parser data
 */
export interface QueryParserData {
    parsedData?: Array<any[] | boolean | number | number | null | ParsedDataObject | string>;
}

export interface ParsedDataObject {
    /**
     * Cost of the query execution
     */
    cost?: number;
    /**
     * Database associated with the table in the query
     */
    databaseName?: string;
    /**
     * Database schema of the associated with query
     */
    databaseSchema?: string;
    /**
     * Date of execution of SQL query
     */
    date?: string;
    /**
     * SQL dialect
     */
    dialect?: string;
    /**
     * How long did the query took to run in milliseconds.
     */
    duration?: number;
    /**
     * Flag to check if query is to be excluded while processing usage
     */
    exclude_usage?: boolean;
    /**
     * Maps each parsed table name of a query to the join information
     */
    joins?: { [key: string]: any };
    /**
     * SQL query type
     */
    query_type?: string;
    /**
     * Name that identifies this database service.
     */
    serviceName: string;
    /**
     * SQL query
     */
    sql: string;
    /**
     * List of tables used in query
     */
    tables: string[];
    /**
     * Name of the user that executed the SQL query
     */
    userName?: string;
    [property: string]: any;
}
