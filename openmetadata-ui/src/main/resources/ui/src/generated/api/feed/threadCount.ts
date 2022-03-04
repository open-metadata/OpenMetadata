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
 * This schema defines the type for reporting the count of threads related to an entity.
 */
export interface ThreadCount {
  counts: EntityLinkThreadCount[];
  /**
   * Total count of all the threads.
   */
  totalCount: number;
}

/**
 * Type used to return thread count per entity link.
 */
export interface EntityLinkThreadCount {
  /**
   * Count of threads for the given entity link.
   */
  count: number;
  entityLink: string;
}
