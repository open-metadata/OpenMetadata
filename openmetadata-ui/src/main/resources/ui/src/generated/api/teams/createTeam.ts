/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/**
 * Team entity
 */
export interface CreateTeam {
  /**
   * Roles to be assigned to all users that are part of this team.
   */
  defaultRoles?: string[];
  /**
   * Optional description of the team.
   */
  description?: string;
  /**
   * Optional name used for display purposes. Example 'Marketing Team'.
   */
  displayName?: string;
  name: string;
  /**
   * Optional team profile information.
   */
  profile?: Profile;
  /**
   * Optional IDs of users that are part of the team.
   */
  users?: string[];
}

/**
 * Optional team profile information.
 *
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
