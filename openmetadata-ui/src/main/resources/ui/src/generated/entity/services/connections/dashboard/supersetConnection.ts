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
 * Superset Connection Config
 */
export interface SupersetConnection {
  /**
   * Additional connection options that can be sent to service during the connection.
   */
  connectionOptions?: { [key: string]: any };
  /**
   * Database Service to create lineage
   */
  dbServiceConnection?: string;
  /**
   * password for the Superset
   */
  password?: string;
  /**
   * authenticaiton provider for the Superset
   */
  provider?: string;
  /**
   * URL for the superset instance
   */
  supersetURL?: string;
  /**
   * Supported Metadata Extraction Pipelines.
   */
  supportedPipelineTypes?: SupportedPipelineTypes;
  /**
   * Service Type
   */
  type?: SupersetType;
  /**
   * username for the Superset
   */
  username?: string;
}

/**
 * Supported Metadata Extraction Pipelines.
 */
export enum SupportedPipelineTypes {
  Metadata = 'Metadata',
}

/**
 * Service Type
 *
 * Superset service type
 */
export enum SupersetType {
  Superset = 'Superset',
}
