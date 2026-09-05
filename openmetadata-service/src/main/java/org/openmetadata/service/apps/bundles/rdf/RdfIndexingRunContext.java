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
package org.openmetadata.service.apps.bundles.rdf;

import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.rdf.RdfWriteMode;

/**
 * Per-run configuration threaded into {@link RdfBatchProcessor}. {@code jobId}/{@code serverId}
 * are the failure-record identity: null on the legacy (non-distributed) path, where failures are
 * accounted only in stats; set by the distributed executor so failed records land in
 * rdf_index_failures and can be retried at end-of-run.
 */
public record RdfIndexingRunContext(
    RdfWriteMode writeMode,
    Set<String> entityTypesInRun,
    UUID jobId,
    String serverId,
    int maxRetries) {

  /**
   * How many individual write attempts a failure-isolation pass may spend before it gives up and
   * marks the remainder failed. Deliberately small: isolating one bad row among many is useful,
   * but attempting every row after a systemic failure is how a slow backend turns one bad batch
   * into hours of timeouts. Operators can raise it from the app's configuration.
   */
  public static final int DEFAULT_MAX_RETRIES = 3;

  public RdfIndexingRunContext {
    writeMode = writeMode != null ? writeMode : RdfWriteMode.RECONCILE;
    entityTypesInRun = entityTypesInRun != null ? Set.copyOf(entityTypesInRun) : Set.of();
    maxRetries = Math.max(0, maxRetries);
  }

  public RdfIndexingRunContext(RdfWriteMode writeMode, Set<String> entityTypesInRun) {
    this(writeMode, entityTypesInRun, null, null, DEFAULT_MAX_RETRIES);
  }

  public RdfIndexingRunContext withJobIdentity(UUID jobId, String serverId) {
    return new RdfIndexingRunContext(writeMode, entityTypesInRun, jobId, serverId, maxRetries);
  }

  public static RdfIndexingRunContext reconcileDefaults() {
    return new RdfIndexingRunContext(RdfWriteMode.RECONCILE, Set.of());
  }

  public static RdfIndexingRunContext forJob(EventPublisherJob job) {
    if (job == null) {
      return reconcileDefaults();
    }
    RdfWriteMode writeMode =
        Boolean.TRUE.equals(job.getRecreateIndex())
            ? RdfWriteMode.INSERT_ONLY
            : RdfWriteMode.RECONCILE;
    return new RdfIndexingRunContext(
        writeMode, job.getEntities(), null, null, resolveMaxRetries(job.getMaxRetries()));
  }

  static int resolveMaxRetries(Integer configured) {
    return configured != null ? Math.max(0, configured) : DEFAULT_MAX_RETRIES;
  }
}
