/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
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
 * Database Connection Config to capture connection details to a database service.
 */
export interface DatabaseConnectionConfig {
  /**
   * Database of the data source.
   */
  database?: string;
  /**
   * Run data profiler as part of ingestion to get table profile data.
   */
  enableDataProfiler?: boolean;
  /**
   * Regex exclude tables or databases that matches the pattern.
   */
  excludeFilterPattern?: string[];
  /**
   * Turn on/off collecting sample data.
   */
  generateSampleData?: boolean;
  /**
   * Host and port of the data source.
   */
  hostPort?: string;
  /**
   * Regex to only fetch tables or databases that matches the pattern.
   */
  includeFilterPattern?: string[];
  /**
   * Optional configuration to turn off fetching metadata for tables.
   */
  includeTables?: boolean;
  /**
   * optional configuration to turn off fetching metadata for views.
   */
  includeViews?: boolean;
  /**
   * password to connect  to the data source.
   */
  password?: string;
  /**
   * query to generate sample data.
   */
  sampleDataQuery?: string;
  /**
   * schema of the data source.
   */
  schema?: string;
  /**
   * username to connect  to the data source.
   */
  username?: string;
}
