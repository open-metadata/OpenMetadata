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

import java.util.concurrent.TimeUnit;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO.RdfReindexLockRecord;

/**
 * Keeps a second RDF reindex from running over one in progress, on this server or another. Quartz
 * only stops the same trigger from overlapping itself, so a scheduled run and an on-demand run
 * could otherwise clear and rewrite the graph at the same time. The lock expires unless renewed,
 * so a run whose server stops holds it for at most {@link #EXPIRY_MS}.
 */
public final class RdfReindexRunLock {
  static final String LOCK_KEY = "RDF_REINDEX_LOCK";
  public static final long EXPIRY_MS = TimeUnit.MINUTES.toMillis(5);

  private final RdfReindexLockDAO locks;
  private final String lockKey;
  private final String runId;
  private final String serverId;

  public RdfReindexRunLock(
      final RdfReindexLockDAO locks,
      final String lockKey,
      final String runId,
      final String serverId) {
    this.locks = locks;
    this.lockKey = lockKey;
    this.runId = runId;
    this.serverId = serverId;
  }

  static RdfReindexRunLock forRun(
      final RdfReindexLockDAO locks, final String runId, final String serverId) {
    return new RdfReindexRunLock(locks, LOCK_KEY, runId, serverId);
  }

  /** Takes the lock, or throws naming the run that holds it. */
  public void acquire() {
    final long now = System.currentTimeMillis();
    if (!locks.tryAcquireLock(lockKey, runId, serverId, now, now + EXPIRY_MS)) {
      throw new IllegalStateException(describeHolder(locks.findByKey(lockKey)));
    }
  }

  public void renew() {
    final long now = System.currentTimeMillis();
    locks.updateHeartbeat(lockKey, runId, now, now + EXPIRY_MS);
  }

  public void release() {
    locks.releaseLock(lockKey, runId);
  }

  private static String describeHolder(final RdfReindexLockRecord holder) {
    return holder == null
        ? "Another RDF reindex is starting; try again once it finishes"
        : String.format(
            "Another RDF reindex is running on server '%s' (run %s); try again once it finishes",
            holder.serverId(), holder.jobId());
  }
}
