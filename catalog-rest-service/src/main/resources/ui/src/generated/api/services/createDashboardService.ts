/**
 * Create Dashboard service entity request
 */
export interface CreateDashboardService {
  /**
   * Dashboard Service URL
   */
  dashboardUrl: string;
  /**
   * Description of dashboard service entity.
   */
  description?: string;
  /**
   * Schedule for running metadata ingestion jobs
   */
  ingestionSchedule?: Schedule;
  /**
   * Name that identifies the this entity instance uniquely
   */
  name: string;
  /**
   * Password to log-into Dashboard Service
   */
  password?: string;
  serviceType: DashboardServiceType;
  /**
   * Username to log-into Dashboard Service
   */
  username?: string;
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
 * Type of Dashboard service - Superset or Lookr
 */
export enum DashboardServiceType {
  Looker = 'Looker',
  Superset = 'Superset',
}
