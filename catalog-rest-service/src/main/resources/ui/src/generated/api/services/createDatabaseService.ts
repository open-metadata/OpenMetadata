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
}
