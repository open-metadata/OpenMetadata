/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Create Database service entity request
 */
export interface CreateDatabaseService {
  /**
   * Description of Database entity.
   */
  description?: string;
  /**
   * Schedule for running metadata ingestion jobs
   */
  ingestionSchedule?: Schedule;
  jdbc: JDBCInfo;
  /**
   * Name that identifies the this entity instance uniquely
   */
  name: string;
  serviceType: DatabaseServiceType;
}

/**
 * Schedule for running metadata ingestion jobs
 *
 * This schema defines the type used for the schedule. The schedule has a start time and
 * repeat frequency.
 */
export interface Schedule {
  /**
   * Repeat frequency in ISO 8601 duration format. Example - 'P23DT23H'.
   */
  repeatFrequency?: string;
  /**
   * Start date and time of the schedule.
   */
  startDate?: Date;
}

/**
 * Type for capturing JDBC connector information.
 */
export interface JDBCInfo {
  connectionUrl: string;
  driverClass: string;
}

/**
 * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
 */
export enum DatabaseServiceType {
  Athena = 'Athena',
  BigQuery = 'BigQuery',
  Hive = 'Hive',
  Mssql = 'MSSQL',
  MySQL = 'MySQL',
  Oracle = 'Oracle',
  Postgres = 'Postgres',
  Presto = 'Presto',
  Redshift = 'Redshift',
  Snowflake = 'Snowflake',
  Trino = 'Trino',
  Vertica = 'Vertica',
}
