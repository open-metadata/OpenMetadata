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

package org.openmetadata.service.rdf.inference;

import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.openmetadata.service.apps.bundles.rdf.RdfReindexRunLock;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;
import org.openmetadata.service.rdf.RdfBackgroundScheduler;
import org.slf4j.LoggerFactory;

/**
 * Keeps materialization runs from overlapping on any server. A run clears every rule graph before
 * recomputing, so a second run interleaving with it would erase facts the first one just derived.
 */
public interface InferenceRunLock {
  boolean tryAcquire(String runId);

  /** Extends the lease, or returns false once it expired and another run took it over. */
  boolean renew(String runId);

  void release(String runId);

  /**
   * Renews the lease in the background until the returned handle runs, so one slow update cannot
   * outlive it while the run is still waiting on that update.
   */
  default Runnable keepAlive(final String runId) {
    return () -> {};
  }

  /** The cluster-wide lease, held in the same lock table the RDF reindex uses. */
  static InferenceRunLock forCluster(final RdfReindexLockDAO locks) {
    return forCluster(
        locks,
        "RDF_INFERENCE_MATERIALIZATION_LOCK",
        ServerIdentityResolver.getInstance().getServerId());
  }

  static InferenceRunLock forCluster(
      final RdfReindexLockDAO locks, final String lockKey, final String serverId) {
    final long heartbeatSeconds = TimeUnit.MILLISECONDS.toSeconds(RdfReindexRunLock.EXPIRY_MS) / 10;
    return new InferenceRunLock() {
      @Override
      public boolean tryAcquire(final String runId) {
        boolean acquired = true;
        try {
          new RdfReindexRunLock(locks, lockKey, runId, serverId).acquire();
        } catch (RdfReindexRunLock.HeldByAnotherRun exception) {
          acquired = false;
        }
        return acquired;
      }

      @Override
      public boolean renew(final String runId) {
        return new RdfReindexRunLock(locks, lockKey, runId, serverId).renew();
      }

      @Override
      public void release(final String runId) {
        new RdfReindexRunLock(locks, lockKey, runId, serverId).release();
      }

      @Override
      public Runnable keepAlive(final String runId) {
        final ScheduledFuture<?> heartbeat =
            RdfBackgroundScheduler.getInstance()
                .scheduleWithFixedDelay(
                    () -> renewQuietly(runId),
                    heartbeatSeconds,
                    heartbeatSeconds,
                    TimeUnit.SECONDS);
        return () -> heartbeat.cancel(false);
      }

      /** A failed renewal is retried on the next beat; the run itself notices a lost lease. */
      private void renewQuietly(final String runId) {
        try {
          renew(runId);
        } catch (RuntimeException exception) {
          LoggerFactory.getLogger(InferenceRunLock.class)
              .warn("Could not renew the inference materialization lock", exception);
        }
      }
    };
  }
}
