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
 * Request to create User entity
 */
export interface CreateUser {
  /**
   * Name used for display purposes. Example 'FirstName LastName'
   */
  displayName?: string;
  email: string;
  /**
   * When true indicates user is an adiministrator for the sytem with superuser privileges
   */
  isAdmin?: boolean;
  /**
   * When true indicates user is a bot with appropriate privileges
   */
  isBot?: boolean;
  name: string;
  profile?: Profile;
  /**
   * Teams that the user belongs to
   */
  teams?: string[];
  /**
   * Timezone of the user
   */
  timezone?: string;
}

/**
 * This schema defines the type for a profile of a user, team, or organization.
 */
export interface Profile {
  images?: ImageList;
}

/**
 * Links to a list of images of varying resolutions/sizes.
 */
export interface ImageList {
  image?: string;
  image192?: string;
  image24?: string;
  image32?: string;
  image48?: string;
  image512?: string;
  image72?: string;
}
