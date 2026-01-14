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
 * Configuration for bulk operations that controls parallelism and resource usage.
 *
 * <p>This uses a bounded thread pool to limit concurrent database operations, preventing bulk
 * operations from exhausting the connection pool and starving regular API requests.
 *
 * <p>Environment variables (for Helm/Docker configuration):
 *
 * <ul>
 *   <li>BULK_OPERATION_MAX_THREADS - Maximum threads for bulk operations
 *   <li>BULK_OPERATION_QUEUE_SIZE - Maximum queued operations before rejection
 *   <li>BULK_OPERATION_TIMEOUT_SECONDS - Timeout for entire bulk operation
 * </ul>
 *
 * <p>Example YAML configuration:
 *
 * <pre>
 * bulkOperation:
 *   maxThreads: ${BULK_OPERATION_MAX_THREADS:-10}
 *   queueSize: ${BULK_OPERATION_QUEUE_SIZE:-1000}
 *   timeoutSeconds: ${BULK_OPERATION_TIMEOUT_SECONDS:-300}
 * </pre>
 */
@Getter
@Setter
public class BulkOperationConfiguration {

  /**
   * Maximum number of threads for bulk operation processing. This directly controls how many
   * concurrent database operations can occur during bulk processing.
   *
   * <p>Recommendations based on DB capacity:
   *
   * <ul>
   *   <li>2 vCore DB: 5-8
   *   <li>4 vCore DB: 8-15
   *   <li>8 vCore DB: 15-25
   *   <li>16+ vCore DB: 25-50
   * </ul>
   *
   * <p>Default: 10 (conservative, works for most deployments)
   */
  @JsonProperty
  @Min(1)
  @Max(100)
  private int maxThreads = 10;

  /**
   * Maximum number of operations that can be queued waiting for a thread. When the queue is full,
   * new bulk requests will be rejected with 503 Service Unavailable.
   *
   * <p>Default: 1000 (allows bursts while preventing memory exhaustion)
   */
  @JsonProperty
  @Min(100)
  @Max(10000)
  private int queueSize = 1000;

  /**
   * Timeout in seconds for the entire bulk operation. If the operation doesn't complete within this
   * time, it will be cancelled and return partial results.
   *
   * <p>Default: 300 seconds (5 minutes)
   */
  @JsonProperty
  @Min(30)
  @Max(3600)
  private int timeoutSeconds = 300;
}
