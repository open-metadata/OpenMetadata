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

import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.rdf.RdfBackgroundScheduler;

/**
 * Periodically sweeps for orphaned distributed RDF reindex work left behind by crashed servers.
 *
 * <p>When a server crashes mid-job its claimed partitions go stale but no surviving server cleans
 * them up on its own. This monitor runs on every server (twin of the search-side {@code
 * OrphanJobMonitor}) and delegates to {@link DistributedRdfIndexCoordinator#performStartupRecovery}
 * to reclaim stale partitions, fail out ones past their retry budget, and refresh aggregated job
 * state.
 */
@Slf4j
public class RdfOrphanJobMonitor {

  private static final long MONITOR_INTERVAL_MINUTES = 2;

  private final DistributedRdfIndexCoordinator coordinator;
  private volatile ScheduledFuture<?> scheduledTask;

  public RdfOrphanJobMonitor(DistributedRdfIndexCoordinator coordinator) {
    this.coordinator = coordinator;
  }

  public synchronized void start() {
    if (scheduledTask != null && !scheduledTask.isDone()) {
      LOG.debug("RdfOrphanJobMonitor already running, skipping start");
      return;
    }

    scheduledTask =
        RdfBackgroundScheduler.getInstance()
            .scheduleWithFixedDelay(
                this::checkForOrphanedJobs,
                MONITOR_INTERVAL_MINUTES,
                MONITOR_INTERVAL_MINUTES,
                TimeUnit.MINUTES);

    LOG.info("RdfOrphanJobMonitor started (interval={}min)", MONITOR_INTERVAL_MINUTES);
  }

  public synchronized void shutdown() {
    if (scheduledTask != null) {
      scheduledTask.cancel(false);
      scheduledTask = null;
      LOG.info("RdfOrphanJobMonitor stopped");
    }
  }

  // Package-private: the sweep's failure containment is unit-tested directly rather
  // than by waiting out the two-minute schedule.
  void checkForOrphanedJobs() {
    try {
      coordinator.performStartupRecovery();
    } catch (Exception e) {
      LOG.error("RdfOrphanJobMonitor failed during recovery sweep", e);
    }
  }
}
