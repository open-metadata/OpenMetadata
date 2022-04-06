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
 * Azure SQL Connection Config
 */
export interface AzureSQLConnection {
  connectionArguments?: { [key: string]: any };
  connectionOptions?: { [key: string]: any };
  /**
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Azure SQL.
   */
  database?: string;
  /**
   * SQLAlchemy driver for Azure SQL
   */
  driver?: string;
  /**
   * Host and port of the Athena
   */
  hostPort?: string;
  /**
   * password to connect  to the Athena.
   */
  password?: string;
  /**
   * SQLAlchemy driver scheme options.
   */
  scheme?: AzureSQLScheme;
  /**
   * Supported Metadata Extraction Pipelines.
   */
  supportedPipelineTypes?: string;
  /**
   * Service Type
   */
  type?: AzureSQLType;
  /**
   * username to connect  to the Athena. This user should have privileges to read all the
   * metadata in Azure SQL.
   */
  username?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum AzureSQLScheme {
  MssqlPyodbc = 'mssql+pyodbc',
}

/**
 * Service Type
 *
 * Service type.
 */
export enum AzureSQLType {
  AzureSQL = 'AzureSQL',
}
