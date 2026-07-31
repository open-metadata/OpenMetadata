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
import lombok.extern.slf4j.Slf4j;

/**
 * Liveness probe target for Dropwizard's admin connector ({@code /healthcheck}).
 *
 * <p><b>This is a pure process-aliveness check by design.</b> If the JVM can run this method
 * and return a value, the pod is alive — that is all kubelet liveness needs to know. We
 * intentionally do <b>not</b> probe the database, the search backend, the cache provider,
 * or any other downstream system from here. Coupling the liveness probe to downstream
 * latency causes counterproductive restart loops: a slow but otherwise functional database
 * makes liveness fail, kubelet kills the pod, the new pod cold-starts (cold cache, fresh
 * connection storms, JIT warmup), the restart pressure pushes the database even harder,
 * and the cycle accelerates. Killing the process never speeds up the database.
 *
 * <p>Operators that want database/cache health visibility should:
 * <ul>
 *   <li>Use a separate <b>readiness</b> probe (or the application-layer endpoints) that can
 *       fail without triggering a pod kill — readiness only stops sending traffic.
 *   <li>Scrape the {@code /prometheus} (or admin metrics) endpoint for HikariCP pool
 *       statistics ({@code hikaricp_active_connections},
 *       {@code hikaricp_pending_threads}, etc.) and alert on those.
 *   <li>Run the existing {@code DatabaseAndSearchServiceStatusJob} background reporter,
 *       which surfaces DB/search status without affecting liveness.
 * </ul>
 *
 * <p>For production deployments, prefer this admin-port {@code /healthcheck} over the
 * application-port {@code /api/v1/system/health} probe target — the admin connector has
 * its own request thread pool, so a saturated API tier (slow listing queries, hot tag
 * aggregations) cannot starve the probe even before any timeout fires.
 */
@Slf4j
public class OpenMetadataServerHealthCheck extends HealthCheck {

  @Override
  protected Result check() {
    return Result.healthy();
  }
}
