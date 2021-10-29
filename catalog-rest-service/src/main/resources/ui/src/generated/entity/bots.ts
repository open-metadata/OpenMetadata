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
 * This schema defines Bot entity. A bot automates tasks, such as adding description,
 * identifying the importance of data. It runs as a special user in the system.
 */
export interface Bots {
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  /**
   * Description of the bot.
   */
  description?: string;
  /**
   * Name used for display purposes. Example 'FirstName LastName'.
   */
  displayName?: string;
  /**
   * Link to the resource corresponding to this bot.
   */
  href?: string;
  /**
   * Unique identifier of a bot instance.
   */
  id?: string;
  /**
   * Name of the bot.
   */
  name?: string;
  /**
   * Last update time corresponding to the new version of the entity.
   */
  updatedAt?: Date;
  /**
   * User who made the update.
   */
  updatedBy?: string;
  /**
   * Metadata version of the entity.
   */
  version?: number;
}

/**
 * Change that lead to this version of the entity.
 *
 * Description of the change.
 */
export interface ChangeDescription {
  /**
   * Fields added during the version changes.
   */
  fieldsAdded?: string[];
  /**
   * Fields deleted during the version changes.
   */
  fieldsDeleted?: string[];
  /**
   * Fields modified during the version changes.
   */
  fieldsUpdated?: string[];
  previousVersion?: number;
}
