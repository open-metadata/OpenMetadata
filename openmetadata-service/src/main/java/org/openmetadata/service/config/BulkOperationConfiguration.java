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
package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

/**
 * Configuration for bulk operations with connection-aware throttling.
 *
 * <p>Uses a semaphore to limit database connections used by bulk operations, preventing pool
 * starvation while maintaining good throughput. Once a request is accepted, it will complete.
 *
 * <p>Auto-scaling (poolPercent=20):
 *
 * <pre>
 * Pool=15  → 3 connections for bulk
 * Pool=50  → 10 connections for bulk
 * Pool=100 → 20 connections for bulk (capped)
 * </pre>
 */
@Getter
@Setter
public class BulkOperationConfiguration {

  /** Hard override for bulk connections. Set 0 for auto-scaling based on poolPercent. */
  @JsonProperty
  @Min(0)
  @Max(100)
  private int maxConnections = 0;

  /** Percentage of pool for bulk operations. Only used when maxConnections=0. Default: 20% */
  @JsonProperty
  @Min(5)
  @Max(50)
  private int poolPercent = 20;

  /** Floor for auto-scaling. Ensures bulk works in small installations. Default: 2 */
  @JsonProperty
  @Min(1)
  @Max(10)
  private int minConnections = 2;

  /** Ceiling for auto-scaling. Prevents DB contention in large installations. Default: 20 */
  @JsonProperty
  @Min(5)
  @Max(100)
  private int maxConnectionsLimit = 20;

  /** Max threads for processing. Capped by connection limit. Default: 10 */
  @JsonProperty
  @Min(1)
  @Max(100)
  private int maxThreads = 10;

  /** Max queued operations. When full, returns 503. Default: 1000 */
  @JsonProperty
  @Min(100)
  @Max(10000)
  private int queueSize = 1000;

  /** Timeout in seconds. Returns partial results if exceeded. Default: 300 */
  @JsonProperty
  @Min(30)
  @Max(3600)
  private int timeoutSeconds = 300;

  public int calculateConnectionLimit(int poolSize) {
    if (maxConnections > 0) {
      return Math.min(maxConnections, poolSize - 1);
    }
    int calculated = (poolSize * poolPercent) / 100;
    return Math.max(minConnections, Math.min(calculated, maxConnectionsLimit));
  }

  public int calculateEffectiveThreads(int connectionLimit) {
    return Math.min(maxThreads, connectionLimit);
  }
}
