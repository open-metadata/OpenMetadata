/**
 * This schema defines the type for reporting the daily count of some measurement. For
 * example, you might use this schema for the number of times a table is queried each day.
 */
export interface DailyCount {
  /**
   * Daily count of a measurement on the given date.
   */
  count: number;
  date: Date;
}
