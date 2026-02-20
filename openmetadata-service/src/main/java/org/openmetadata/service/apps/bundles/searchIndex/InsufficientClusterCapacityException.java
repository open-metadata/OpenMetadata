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

package org.openmetadata.service.apps.bundles.searchIndex;

import lombok.Getter;

/**
 * Exception thrown when there is insufficient cluster capacity to create new indices. This
 * typically occurs when the cluster is approaching its shard limit.
 */
@Getter
public class InsufficientClusterCapacityException extends RuntimeException {

  private final int currentShards;
  private final int maxShards;
  private final int requestedShards;
  private final double usagePercent;

  public InsufficientClusterCapacityException(
      int currentShards, int maxShards, int requestedShards, double usagePercent) {
    super(
        String.format(
            "Insufficient cluster capacity: current shards=%d, max shards=%d (%.1f%% used), "
                + "requested=%d shards. Clean up orphaned indices or increase cluster capacity.",
            currentShards, maxShards, usagePercent * 100, requestedShards));
    this.currentShards = currentShards;
    this.maxShards = maxShards;
    this.requestedShards = requestedShards;
    this.usagePercent = usagePercent;
  }

  public InsufficientClusterCapacityException(
      int currentShards, int maxShards, double usagePercent) {
    super(
        String.format(
            "Cluster shard usage at %.1f%% (%d/%d shards). "
                + "Clean up orphaned indices before recreating indices.",
            usagePercent * 100, currentShards, maxShards));
    this.currentShards = currentShards;
    this.maxShards = maxShards;
    this.requestedShards = 0;
    this.usagePercent = usagePercent;
  }
}
