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
 * Configuration for bulk operations that controls parallelism and resource usage. This
 * configuration helps prevent bulk operations from exhausting database connections and ensures
 * regular user traffic is prioritized.
 *
 * <p>Environment variables (for Helm/Docker configuration):
 *
 * <ul>
 *   <li>BULK_OPERATION_MAX_CONCURRENT_DB_OPERATIONS - Max concurrent DB operations
 *   <li>BULK_OPERATION_CONNECTION_PERCENTAGE - % of pool allocated to bulk ops
 *   <li>BULK_OPERATION_AUTO_SCALE - Enable auto-scaling based on pool size
 *   <li>BULK_OPERATION_ACQUIRE_TIMEOUT_MS - Timeout for acquiring permits
 * </ul>
 *
 * <p>Example YAML configuration with env vars:
 *
 * <pre>
 * bulkOperation:
 *   maxConcurrentDbOperations: ${BULK_OPERATION_MAX_CONCURRENT_DB_OPERATIONS:-10}
 *   bulkConnectionPercentage: ${BULK_OPERATION_CONNECTION_PERCENTAGE:-20}
 *   autoScale: ${BULK_OPERATION_AUTO_SCALE:-true}
 *   acquireTimeoutMs: ${BULK_OPERATION_ACQUIRE_TIMEOUT_MS:-30000}
 * </pre>
 */
@Getter
@Setter
public class BulkOperationConfiguration {

  /**
   * Maximum number of concurrent database operations allowed during bulk processing. This uses a
   * semaphore to limit concurrent DB access, not thread count. Virtual threads are cheap; DB
   * connections are the limited resource.
   *
   * <p>Default: 10 (conservative for small DB instances)
   *
   * <p>Recommendations based on DB capacity:
   *
   * <ul>
   *   <li>2 vCore DB: 5-10
   *   <li>4 vCore DB: 10-20
   *   <li>8 vCore DB: 20-40
   *   <li>16+ vCore DB: 40-80
   * </ul>
   *
   * <p>Env var: BULK_OPERATION_MAX_CONCURRENT_DB_OPERATIONS
   */
  @JsonProperty
  @Min(1)
  @Max(200)
  private int maxConcurrentDbOperations = 10;

  /**
   * Percentage of the connection pool to allocate for bulk operations. The remaining connections
   * are reserved for regular user traffic (API requests, UI, etc.).
   *
   * <p>User traffic is prioritized - bulk operations only get a portion of the pool.
   *
   * <p>Default: 20% (bulk operations get 20%, regular traffic gets 80%)
   *
   * <p>Examples:
   *
   * <ul>
   *   <li>Pool size 100, percentage 20% → Bulk gets max 20 concurrent ops
   *   <li>Pool size 50, percentage 30% → Bulk gets max 15 concurrent ops
   * </ul>
   *
   * <p>Env var: BULK_OPERATION_CONNECTION_PERCENTAGE
   */
  @JsonProperty
  @Min(5)
  @Max(50)
  private int bulkConnectionPercentage = 20;

  /**
   * Whether to automatically calculate maxConcurrentDbOperations based on the connection pool size.
   * When enabled: effectiveMax = min(poolSize * bulkConnectionPercentage / 100,
   * maxConcurrentDbOperations)
   *
   * <p>Default: true (auto-calculate based on pool size)
   *
   * <p>Env var: BULK_OPERATION_AUTO_SCALE
   */
  @JsonProperty private boolean autoScale = true;

  /**
   * Timeout in milliseconds to wait for a permit before failing a bulk operation. This prevents
   * indefinite blocking when the system is overloaded. Failed operations return 503 Service
   * Unavailable.
   *
   * <p>Default: 30000ms (30 seconds)
   *
   * <p>Env var: BULK_OPERATION_ACQUIRE_TIMEOUT_MS
   */
  @JsonProperty
  @Min(1000)
  @Max(300000)
  private long acquireTimeoutMs = 30000;
}
