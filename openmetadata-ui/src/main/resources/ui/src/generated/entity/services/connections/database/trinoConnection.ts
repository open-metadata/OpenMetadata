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
 * Trino Connection Config
 */
export interface TrinoConnection {
  /**
   * Catalog of the data source.
   */
  catalog?: string;
  connectionArguments?: ConnectionArguments;
  connectionOptions?: { [key: string]: any };
  /**
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in the selected catalog in Trino.
   */
  database?: string;
  /**
   * Host and port of the data source.
   */
  hostPort?: string;
  /**
   * URL parameters for connection to the Trino data source
   */
  params?: { [key: string]: any };
  /**
   * password to connect  to the Trino.
   */
  password?: string;
  /**
   * Proxies for the connection to Trino data source
   */
  proxies?: { [key: string]: any };
  /**
   * SQLAlchemy driver scheme options.
   */
  scheme?: TrinoScheme;
  /**
   * Supported Metadata Extraction Pipelines.
   */
  supportedPipelineTypes?: string;
  /**
   * Service Type
   */
  type?: TrinoType;
  /**
   * username to connect to Trino. This user should have privileges to read all the metadata
   * in Trino.
   */
  username?: string;
}

/**
 * Additional connection arguments such as security or protocol configs that can be sent to
 * service during connection.
 */
export interface ConnectionArguments {
  /**
   * HTTP path of databricks cluster
   */
  http_path?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum TrinoScheme {
  Trino = 'trino',
}

/**
 * Service Type
 *
 * Service type.
 */
export enum TrinoType {
  Trino = 'Trino',
}
