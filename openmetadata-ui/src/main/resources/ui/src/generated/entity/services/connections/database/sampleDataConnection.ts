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
 * Sample Data Connection Config
 */
export interface SampleDataConnection {
  connectionArguments?: { [key: string]: string };
  connectionOptions?: { [key: string]: string };
  /**
   * Sample Data File Path
   */
  sampleDataFolder?: string;
  supportsMetadataExtraction?: boolean;
  supportsUsageExtraction?: boolean;
  /**
   * Service Type
   */
  type?: SampleDataType;
}

/**
 * Service Type
 *
 * Service type.
 */
export enum SampleDataType {
  SampleData = 'SampleData',
}
