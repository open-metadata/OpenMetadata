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
 * Create Storage service entity request
 */
export interface CreateStorageService {
  /**
   * Description of Storage entity.
   */
  description?: string;
  /**
   * Name that identifies the this entity instance uniquely
   */
  name: string;
  serviceType?: StorageServiceType;
}

/**
 * Type of storage service such as S3, GCS, HDFS...
 */
export enum StorageServiceType {
  Abfs = 'ABFS',
  Gcs = 'GCS',
  Hdfs = 'HDFS',
  S3 = 'S3',
}
