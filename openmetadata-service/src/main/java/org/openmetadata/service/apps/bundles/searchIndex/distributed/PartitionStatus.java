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

/** Status of a search index partition during distributed reindexing. */
public enum PartitionStatus {
  /** Partition created but not yet claimed by any server */
  PENDING,

  /** Partition has been claimed by a server and is being processed */
  PROCESSING,

  /** Partition processing completed successfully */
  COMPLETED,

  /** Partition processing failed after exhausting retries */
  FAILED,

  /** Partition was cancelled (job stopped) */
  CANCELLED
}
