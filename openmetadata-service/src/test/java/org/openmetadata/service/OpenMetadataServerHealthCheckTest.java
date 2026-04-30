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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.codahale.metrics.health.HealthCheck.Result;
import org.jdbi.v3.core.statement.StatementException;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Unit tests for {@link OpenMetadataServerHealthCheck}. The class is the target k8s probes
 * hit, so each branch matters: a passing probe in front of a failing DB used to leave a
 * starved pod alive, which is exactly what we are trying to surface now.
 */
class OpenMetadataServerHealthCheckTest {

  @Test
  void check_returnsHealthy_whenDaoIsNull() {
    // Cold-start window: app bootstrap registers the check before the DAO is wired up.
    // Returning healthy in that window avoids racing the probe past startup.
    OpenMetadataServerHealthCheck check = new OpenMetadataServerHealthCheck(null);
    Result result = check.check();
    assertTrue(result.isHealthy(), "null DAO must short-circuit to healthy");
  }

  @Test
  void check_returnsHealthy_whenDbProbeReturns42() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.SystemDAO systemDAO = mock(CollectionDAO.SystemDAO.class);
    when(dao.systemDAO()).thenReturn(systemDAO);
    when(systemDAO.testConnection()).thenReturn(42);

    OpenMetadataServerHealthCheck check = new OpenMetadataServerHealthCheck(dao);
    Result result = check.check();

    assertTrue(result.isHealthy(), "successful DB probe must report healthy");
  }

  @Test
  void check_returnsUnhealthy_whenDbProbeThrows() {
    // Simulates DB connectivity loss / pool exhaustion / driver failure. The probe must
    // surface unhealthy so k8s evicts the pod instead of leaving traffic stuck.
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.SystemDAO systemDAO = mock(CollectionDAO.SystemDAO.class);
    when(dao.systemDAO()).thenReturn(systemDAO);
    when(systemDAO.testConnection())
        .thenThrow(new RuntimeException("connection refused — DB is down"));

    OpenMetadataServerHealthCheck check = new OpenMetadataServerHealthCheck(dao);
    Result result = check.check();

    assertFalse(result.isHealthy(), "DB error must report unhealthy");
    assertTrue(
        result.getMessage().contains("Database probe failed"),
        "error message should be propagated for triage");
  }

  @Test
  void check_returnsUnhealthy_whenDbProbeExceedsTimeout() throws Exception {
    // Simulates a hung DB borrow — the probe must NOT block longer than the configured
    // timeout, otherwise the k8s liveness probe itself stalls and the symptom looks like
    // a healthy slow pod when it should be a failing pod.
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.SystemDAO systemDAO = mock(CollectionDAO.SystemDAO.class);
    when(dao.systemDAO()).thenReturn(systemDAO);
    when(systemDAO.testConnection())
        .thenAnswer(
            invocation -> {
              // Sleep well past the 2 s health-check budget to force the timeout path.
              Thread.sleep(OpenMetadataServerHealthCheck.DB_TIMEOUT_MILLIS + 1_000);
              return 42;
            });

    OpenMetadataServerHealthCheck check = new OpenMetadataServerHealthCheck(dao);
    long start = System.nanoTime();
    Result result = check.check();
    long elapsedMillis = (System.nanoTime() - start) / 1_000_000;

    assertFalse(result.isHealthy(), "timed-out probe must report unhealthy");
    assertTrue(
        elapsedMillis < OpenMetadataServerHealthCheck.DB_TIMEOUT_MILLIS + 500,
        "probe must respect its own timeout; took " + elapsedMillis + " ms");
  }

  @Test
  void check_returnsUnhealthy_whenDbProbeReturnsUnexpectedValue() {
    // Defensive: if the canary query returns something other than 42 (driver bug,
    // wrong query routed somehow), surface it instead of silently passing.
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.SystemDAO systemDAO = mock(CollectionDAO.SystemDAO.class);
    when(dao.systemDAO()).thenReturn(systemDAO);
    when(systemDAO.testConnection()).thenReturn(0);

    OpenMetadataServerHealthCheck check = new OpenMetadataServerHealthCheck(dao);
    Result result = check.check();

    assertFalse(result.isHealthy());
    assertTrue(result.getMessage().contains("unexpected value"));
  }

  @Test
  void check_returnsUnhealthy_whenJdbiThrowsCheckedException() {
    // StatementException is the JDBI-specific failure surface; ensure it lands in the
    // generic failure branch instead of escaping uncaught.
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.SystemDAO systemDAO = mock(CollectionDAO.SystemDAO.class);
    when(dao.systemDAO()).thenReturn(systemDAO);
    when(systemDAO.testConnection())
        .thenThrow(new RuntimeException(new StatementException("driver said no") {}));

    OpenMetadataServerHealthCheck check = new OpenMetadataServerHealthCheck(dao);
    Result result = check.check();

    assertFalse(result.isHealthy());
  }
}
