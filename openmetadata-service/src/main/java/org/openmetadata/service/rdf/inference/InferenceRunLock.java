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

import org.openmetadata.service.apps.bundles.rdf.RdfReindexRunLock;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;

/**
 * Keeps materialization runs from overlapping on any server. A run clears every rule graph before
 * recomputing, so a second run interleaving with it would erase facts the first one just derived.
 */
public interface InferenceRunLock {
  boolean tryAcquire(String runId);

  /** Extends the lease, or returns false once it expired and another run took it over. */
  boolean renew(String runId);

  void release(String runId);

  /** The cluster-wide lease, held in the same lock table the RDF reindex uses. */
  static InferenceRunLock forCluster(final RdfReindexLockDAO locks) {
    final String lockKey = "RDF_INFERENCE_MATERIALIZATION_LOCK";
    final String serverId = ServerIdentityResolver.getInstance().getServerId();
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
    };
  }
}
