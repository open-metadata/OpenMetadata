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
 * Google BigQuery Connection Config
 */
export interface BigQueryConnection {
  connectionArguments?: { [key: string]: string };
  connectionOptions?: { [key: string]: string };
  /**
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Athena.
   */
  database?: string;
  /**
   * Enable importing policy tags of BigQuery into OpenMetadata
   */
  enablePolicyTagImport?: boolean;
  /**
   * BigQuery APIs URL
   */
  hostPort?: string;
  /**
   * Column name on which bigquery table will be partitioned
   */
  partitionField?: string;
  /**
   * Partitioning query for bigquery tables
   */
  partitionQuery?: string;
  /**
   * Duration for partitioning bigquery tables
   */
  partitionQueryDuration?: number;
  /**
   * Google BigQuery project id.
   */
  projectID?: string;
  /**
   * SQLAlchemy driver scheme options.
   */
  scheme?: BigqueryScheme;
  supportsMetadataExtraction?: boolean;
  supportsUsageExtraction?: boolean;
  /**
   * OpenMetadata Tag category name if enablePolicyTagImport is set to true.
   */
  tagCategoryName?: string;
  /**
   * Service Type
   */
  type?: BigqueryType;
  /**
   * username to connect  to the Athena. This user should have privileges to read all the
   * metadata in Athena.
   */
  username?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum BigqueryScheme {
  Bigquery = 'bigquery',
}

/**
 * Service Type
 *
 * Service type.
 */
export enum BigqueryType {
  BigQuery = 'BigQuery',
}
