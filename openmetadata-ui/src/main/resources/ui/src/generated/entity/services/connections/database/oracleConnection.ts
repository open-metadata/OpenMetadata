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
 * Oracle Database Connection Config
 */
export interface OracleConnection {
  connectionArguments?: { [key: string]: string };
  connectionOptions?: { [key: string]: string };
  /**
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Oracle.
   */
  database?: string;
  /**
   * Host and port of the Oracle.
   */
  hostPort?: string;
  /**
   * Oracle Service Name to be passed. Note: either Database or Oracle service name can be
   * sent, not both.
   */
  oracleServiceName?: string;
  /**
   * password to connect  to the Oracle.
   */
  password?: string;
  /**
   * SQLAlchemy driver scheme options.
   */
  scheme?: OracleScheme;
  supportsMetadataExtraction?: boolean;
  /**
   * Service Type
   */
  type?: OracleType;
  /**
   * username to connect  to the Oracle. This user should have privileges to read all the
   * metadata in Oracle.
   */
  username?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum OracleScheme {
  OracleCxOracle = 'oracle+cx_oracle',
}

/**
 * Service Type
 *
 * Service type.
 */
export enum OracleType {
  Oracle = 'Oracle',
}
