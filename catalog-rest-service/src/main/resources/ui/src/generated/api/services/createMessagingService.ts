/**
 * Create Messaging service entity request
 */
export interface CreateMessagingService {
  /**
   * Multiple bootstrap addresses for Kafka. Single proxy address for Pulsar.
   */
  brokers: string[];
  /**
   * Description of messaging service entity.
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
   * Schema registry URL
   */
  schemaRegistry?: string;
  serviceType: MessagingServiceType;
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
 * Type of messaging service - Kafka or Pulsar.
 */
export enum MessagingServiceType {
  Kafka = 'Kafka',
  Pulsar = 'Pulsar',
}
