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
 * Databricks Connection Config
 */
export interface DatabricksConnection {
  connectionArguments?: { [key: string]: string };
  connectionOptions?: { [key: string]: string };
  /**
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Databricks.
   */
  database?: string;
  /**
   * Host and port of the Databricks
   */
  hostPort?: string;
  /**
   * password to connect to the Databricks.
   */
  password?: string;
  /**
   * SQLAlchemy driver scheme options.
   */
  scheme?: DatabricksScheme;
  supportsMetadataExtraction?: boolean;
  /**
   * Generated Token to connect to Databricks
   */
  token?: string;
  /**
   * Service Type
   */
  type?: DatabricksType;
  /**
   * username to connect  to the Databricks. This user should have privileges to read all the
   * metadata in Databricks.
   */
  username?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum DatabricksScheme {
  DatabricksConnector = 'databricks+connector',
}

/**
 * Service Type
 *
 * Service type.
 */
export enum DatabricksType {
  Databricks = 'Databricks',
}
