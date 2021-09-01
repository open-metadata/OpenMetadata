/**
 * Update Dashboard service entity request
 */
export interface UpdateDashboardService {
  /**
   * Dashboard Service URL
   */
  dashboardUrl?: string;
  /**
   * Description of Dashboard service entity.
   */
  description?: string;
  /**
   * Schedule for running metadata ingestion jobs
   */
  ingestionSchedule?: Schedule;
  /**
   * Password to log-into Dashboard Service
   */
  password?: string;
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
