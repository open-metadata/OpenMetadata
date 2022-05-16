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
 * DeltaLake Database Connection Config
 */
export interface DeltaLakeConnection {
  /**
   * pySpark App Name.
   */
  appName?: string;
  connectionArguments?: { [key: string]: any };
  connectionOptions?: { [key: string]: any };
  /**
   * File path of the local Hive Metastore.
   */
  metastoreFilePath?: string;
  /**
   * Host and port of the remote Hive Metastore.
   */
  metastoreHostPort?: string;
  supportsMetadataExtraction?: boolean;
  supportsProfiler?: boolean;
  /**
   * Service Type
   */
  type?: DeltaLakeType;
}

/**
 * Service Type
 *
 * Service type.
 */
export enum DeltaLakeType {
  DeltaLake = 'DeltaLake',
}
