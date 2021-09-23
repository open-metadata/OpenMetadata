/**
 * This schema defines the Database Service entity, such as MySQL, BigQuery, Redshift,
 * Postgres, or Snowflake. Alternative terms such as Database Cluster, Database Server
 * instance are also used for database service.
 */
export interface DatabaseService {
  /**
   * Description of a database service instance.
   */
  description?: string;
  /**
   * Link to the resource corresponding to this database service.
   */
  href: string;
  /**
   * Unique identifier of this database service instance.
   */
  id: string;
  /**
   * Schedule for running metadata ingestion jobs.
   */
  ingestionSchedule?: Schedule;
  /**
   * JDBC connection information.
   */
  jdbc: JDBCInfo;
  /**
   * Name that identifies this database service.
   */
  name: string;
  /**
   * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
   */
  serviceType: DatabaseServiceType;
}

/**
 * Schedule for running metadata ingestion jobs.
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
 * JDBC connection information.
 *
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
  Vertica = 'Vertica',
}
