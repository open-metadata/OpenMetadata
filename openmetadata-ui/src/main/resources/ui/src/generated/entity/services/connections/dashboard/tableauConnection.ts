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
 * Tableau Connection Config
 */
export interface TableauConnection {
  /**
   * Tableau API version
   */
  apiVersion?: string;
  /**
   * Tableau Environment Name
   */
  env?: string;
  /**
   * Tableau Server
   */
  hostPort?: string;
  /**
   * password for the Tableau
   */
  password?: string;
  /**
   * Personal Access Token Name
   */
  personalAccessTokenName?: string;
  /**
   * Personal Access Token Secret
   */
  personalAccessTokenSecret?: string;
  /**
   * Tableau Site Name
   */
  siteName?: string;
  supportsMetadataExtraction?: boolean;
  /**
   * Service Type
   */
  type?: TableauType;
  /**
   * username for the Tableau
   */
  username?: string;
}

/**
 * Service Type
 *
 * Tableau service type
 */
export enum TableauType {
  Tableau = 'Tableau',
}
