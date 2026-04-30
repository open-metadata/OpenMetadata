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

package org.openmetadata.service;

import com.codahale.metrics.health.HealthCheck;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Health check executed by Dropwizard's {@code /healthcheck} endpoint and consumed by k8s
 * liveness/readiness probes.
 *
 * <p>Pre-fix this method was {@code return Result.healthy()} — k8s probes always succeeded
 * even when the database was unreachable or the connection pool was fully starved. As long
 * as Jetty had a free request thread, the pod stayed "alive" while real traffic hung. That
 * masked the exact failure mode operators needed to surface.
 *
 * <p>The check now:
 * <ul>
 *   <li>Borrows a connection from the main pool and runs {@code SELECT 42} (the same probe
 *       used by the existing background {@code DatabseAndSearchServiceStatusJob}).
 *   <li>Caps the whole operation at {@value #DB_TIMEOUT_MILLIS} ms via a watchdog future,
 *       so the probe never runs longer than k8s tolerates. If the DB borrow + query don't
 *       complete in time, the probe fails and k8s can evict the pod cleanly.
 *   <li>Falls back to {@code Result.healthy()} if no {@link CollectionDAO} has been wired
 *       (early in startup, in tests, or for deployments that don't use the JDBI bundle).
 * </ul>
 */
@Slf4j
public class OpenMetadataServerHealthCheck extends HealthCheck {

  /**
   * Hard cap on the health check itself. Must stay well under the typical k8s probe timeout
   * (3-5 s default for liveness). We use 2 s here so the probe fails fast while leaving
   * headroom for the rare slow-DB blip.
   */
  static final long DB_TIMEOUT_MILLIS = 2_000L;

  private static final ExecutorService HEALTH_EXECUTOR =
      Executors.newSingleThreadExecutor(
          new ThreadFactory() {
            private final AtomicLong threadIndex = new AtomicLong();

            @Override
            public Thread newThread(Runnable r) {
              Thread thread = new Thread(r, "om-healthcheck-" + threadIndex.incrementAndGet());
              thread.setDaemon(true);
              return thread;
            }
          });

  private final CollectionDAO dao;

  public OpenMetadataServerHealthCheck() {
    this(null);
  }

  public OpenMetadataServerHealthCheck(CollectionDAO dao) {
    this.dao = dao;
  }

  @Override
  protected Result check() {
    if (dao == null) {
      // No DAO wired yet (cold-start window) — treat as healthy. Once the app finishes
      // bootstrapping the DAO is non-null and we'll start probing the DB.
      return Result.healthy();
    }

    Callable<Result> probe =
        () -> {
          try {
            Integer value = dao.systemDAO().testConnection();
            return value != null && value == 42
                ? Result.healthy()
                : Result.unhealthy("Database probe returned unexpected value: " + value);
          } catch (Exception e) {
            return Result.unhealthy("Database probe failed: " + e.getMessage());
          }
        };

    Future<Result> future = HEALTH_EXECUTOR.submit(probe);
    try {
      return future.get(DB_TIMEOUT_MILLIS, TimeUnit.MILLISECONDS);
    } catch (TimeoutException e) {
      future.cancel(true);
      LOG.warn(
          "Health check exceeded {} ms — failing the probe so k8s can recycle the pod",
          DB_TIMEOUT_MILLIS);
      return Result.unhealthy(
          "Database probe did not complete in " + DB_TIMEOUT_MILLIS + " ms");
    } catch (Exception e) {
      LOG.warn("Health check raised an unexpected error", e);
      return Result.unhealthy("Health check error: " + e.getMessage());
    }
  }
}
