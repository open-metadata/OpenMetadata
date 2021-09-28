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
 * This schema defines the Messaging Service entity, such as Kafka and Pulsar.
 */
export interface DashboardService {
  /**
   * Dashboard Service URL. This will be used to make REST API calls to Dashboard Service.
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
   * Password to log-into Dashboard Service.
   */
  password?: string;
  /**
   * Type of dashboard service such as Looker or Superset...
   */
  serviceType: DashboardServiceType;
  /**
   * Username to log-into Dashboard Service.
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
 * Type of dashboard service such as Looker or Superset...
 *
 * Type of Dashboard service - Superset, Looker, Redash or Tableau.
 */
export enum DashboardServiceType {
  Looker = 'Looker',
  Redash = 'Redash',
  Superset = 'Superset',
  Tableau = 'Tableau',
}
