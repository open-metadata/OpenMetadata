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
 * Looker Connection Config
 */
export interface LookerConnection {
  /**
   * Looker Environment
   */
  env?: string;
  /**
   * URL to Looker instance.
   */
  hostPort?: string;
  /**
   * password to connect  to the Looker.
   */
  password?: string;
  /**
   * Supported Metadata Extraction Pipelines.
   */
  supportedPipelineTypes?: SupportedPipelineTypes;
  /**
   * Service Type
   */
  type?: LookerType;
  /**
   * username to connect  to the Looker. This user should have privileges to read all the
   * metadata in Looker.
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
 * Looker service type
 */
export enum LookerType {
  Looker = 'Looker',
}
