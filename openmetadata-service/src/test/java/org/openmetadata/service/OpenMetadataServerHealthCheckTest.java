/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.codahale.metrics.health.HealthCheck.Result;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link OpenMetadataServerHealthCheck}.
 *
 * <p>The health check is intentionally a pure process-aliveness probe — it must not borrow
 * a DB connection, run a query, or call any downstream system. These tests pin that
 * contract: a future refactor that adds a DB ping (or any other I/O) here will break the
 * "must complete in microseconds without I/O" assertion and force the author to revisit
 * the design rationale documented on the class.
 */
class OpenMetadataServerHealthCheckTest {

  @Test
  void check_returnsHealthy() {
    OpenMetadataServerHealthCheck check = new OpenMetadataServerHealthCheck();
    Result result = check.check();
    assertTrue(result.isHealthy(), "process-aliveness probe must always be healthy");
  }

  @Test
  void check_isFastAndDoesNotPerformIo() {
    // The probe must not hit the DB or any other downstream system. We can't introspect
    // that directly in a unit test, but we can pin a tight latency budget — anything
    // doing I/O would blow this. The bound is intentionally low (1 ms) so any future
    // regression that adds a DB borrow shows up immediately even on slow CI.
    OpenMetadataServerHealthCheck check = new OpenMetadataServerHealthCheck();
    long start = System.nanoTime();
    Result result = check.check();
    long elapsedMicros = (System.nanoTime() - start) / 1_000;

    assertTrue(result.isHealthy());
    assertTrue(
        elapsedMicros < 1_000,
        "health check must complete in microseconds without I/O; took " + elapsedMicros + " µs");
  }
}
