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

package org.openmetadata.service.apps.bundles.rdf.distributed;

import java.time.Duration;
import java.util.Collection;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfIndexPartitionDAO;

/** Keeps both coordinator and participant claims alive while reads or sink writes are pending. */
@Slf4j
final class RdfPartitionHeartbeat implements AutoCloseable {
  private static final Duration INTERVAL = Duration.ofSeconds(30);
  private final ScheduledExecutorService scheduler;

  RdfPartitionHeartbeat(
      final RdfIndexPartitionDAO partitions,
      final Supplier<? extends Collection<RdfIndexPartition>> activeClaims) {
    this(partitions, activeClaims, INTERVAL);
  }

  RdfPartitionHeartbeat(
      final RdfIndexPartitionDAO partitions,
      final Supplier<? extends Collection<RdfIndexPartition>> activeClaims,
      final Duration interval) {
    if (interval.toMillis() <= 0) {
      throw new IllegalArgumentException("RDF partition heartbeat interval must be positive");
    }
    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            Thread.ofVirtual().name("rdf-partition-heartbeat").factory());
    scheduler.scheduleWithFixedDelay(
        () -> activeClaims.get().forEach(claim -> renew(partitions, claim)),
        interval.toMillis(),
        interval.toMillis(),
        TimeUnit.MILLISECONDS);
  }

  private void renew(final RdfIndexPartitionDAO partitions, final RdfIndexPartition claim) {
    try {
      final int updated =
          partitions.updateHeartbeat(
              claim.getId().toString(),
              System.currentTimeMillis(),
              claim.getAssignedServer(),
              claim.getClaimedAt());
      if (updated == 0) {
        LOG.debug("RDF partition {} heartbeat rejected after its claim ended", claim.getId());
      }
    } catch (RuntimeException failure) {
      LOG.warn("Failed to renew RDF partition {} claim", claim.getId(), failure);
    }
  }

  @Override
  public void close() {
    scheduler.shutdownNow();
    try {
      if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
        LOG.warn("Timed out waiting for RDF partition heartbeats to stop");
      }
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
    }
  }
}
