/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

/** Status of a distributed search index job. */
public enum IndexJobStatus {
  /** Job created, partitions being calculated */
  INITIALIZING,

  /** Partitions created, ready for processing */
  READY,

  /** Job is actively being processed by servers */
  RUNNING,

  /** Job completed successfully */
  COMPLETED,

  /** Job completed with some errors but continued */
  COMPLETED_WITH_ERRORS,

  /** Job failed and cannot continue */
  FAILED,

  /** Job is being stopped */
  STOPPING,

  /** Job was stopped by user request */
  STOPPED
}
