/**
 * This schema defines the Messaging Service entity, such as Kafka and Pulsar.
 */
export interface DashboardService {
  /**
   * Dashboard Service URL. This will be used to make REST API calls to Dashboard Service
   */
  dashboardUrl: string;
  /**
   * Description of a dashboard service instance.
   */
  description?: string;
  /**
   * Link to the resource corresponding to this messaging service.
   */
  href?: string;
  /**
   * Unique identifier of this dashboard service instance.
   */
  id: string;
  /**
   * Schedule for running metadata ingestion jobs.
   */
  ingestionSchedule?: Schedule;
  /**
   * Name that identifies this dashboard service.
   */
  name: string;
  /**
   * Password to log-into Dashboard Service
   */
  password?: string;
  /**
   * Type of dashboard service such as Lookr or Superset...
   */
  serviceType: DashboardServiceType;
  /**
   * Username to log-into Dashboard Service
   */
  username?: string;
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
 * Type of dashboard service such as Lookr or Superset...
 *
 * Type of Dashboard service - Superset or Lookr
 */
export enum DashboardServiceType {
  Looker = 'Looker',
  Superset = 'Superset',
}
