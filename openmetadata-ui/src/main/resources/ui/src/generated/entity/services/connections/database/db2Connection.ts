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
 * DB2 Connection Config
 */
export interface Db2Connection {
  connectionArguments?: { [key: string]: any };
  connectionOptions?: { [key: string]: any };
  /**
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in DB2.
   */
  database?: string;
  /**
   * Host and port of the DB2
   */
  hostPort?: string;
  /**
   * password to connect to the DB2.
   */
  password?: string;
  /**
   * SQLAlchemy driver scheme options.
   */
  scheme?: Db2Scheme;
  /**
   * Supported Metadata Extraction Pipelines.
   */
  supportedPipelineTypes?: string;
  /**
   * Service Type
   */
  type?: Db2Type;
  /**
   * username to connect  to the DB2. This user should have privileges to read all the
   * metadata in DB2.
   */
  username?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum Db2Scheme {
  Db2IBMDB = 'db2+ibm_db',
}

/**
 * Service Type
 *
 * Service type.
 */
export enum Db2Type {
  Db2 = 'Db2',
}
