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
 * Postgres Database Connection Config
 */
export interface PostgresConnection {
  connectionArguments?: { [key: string]: any };
  connectionOptions?: { [key: string]: any };
  /**
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Postgres.
   */
  database?: string;
  /**
   * Host and port of the Postgres.
   */
  hostPort?: string;
  /**
   * password to connect  to the Postgres.
   */
  password?: string;
  /**
   * SQLAlchemy driver scheme options.
   */
  scheme?: PostgresScheme;
  /**
   * Supported Metadata Extraction Pipelines.
   */
  supportedPipelineTypes?: string;
  /**
   * Service Type
   */
  type?: PostgresType;
  /**
   * username to connect  to the Postgres. This user should have privileges to read all the
   * metadata in Postgres.
   */
  username?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum PostgresScheme {
  PostgresqlPsycopg2 = 'postgresql+psycopg2',
}

/**
 * Service Type
 *
 * Service type.
 */
export enum PostgresType {
  Postgres = 'Postgres',
}
