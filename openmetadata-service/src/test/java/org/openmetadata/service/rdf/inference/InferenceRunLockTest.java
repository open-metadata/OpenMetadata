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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO.RdfReindexLockRecord;

class InferenceRunLockTest {
  private final InMemoryLockTable locks = new InMemoryLockTable();
  private final InferenceRunLock runLock = InferenceRunLock.forCluster(locks);

  @Test
  void aSecondRunCannotStartWhileTheFirstHoldsTheLock() {
    assertTrue(runLock.tryAcquire("run-1"));

    assertFalse(runLock.tryAcquire("run-2"));
  }

  @Test
  void theLockIsFreeOnceItsHolderReleasesIt() {
    runLock.tryAcquire("run-1");

    runLock.release("run-1");

    assertTrue(runLock.tryAcquire("run-2"));
  }

  @Test
  void releasingAnotherRunsLockLeavesItHeld() {
    runLock.tryAcquire("run-1");

    runLock.release("run-2");

    assertFalse(runLock.tryAcquire("run-3"));
  }

  @Test
  void aRunWhoseExpiredLockWasTakenOverCannotRenewIt() {
    runLock.tryAcquire("run-1");
    locks.expireAll();
    assertTrue(runLock.tryAcquire("run-2"));

    assertFalse(runLock.renew("run-1"));
    assertTrue(runLock.renew("run-2"));
  }

  /** The {@code rdf_reindex_lock} table, with the row semantics of the SQL DAO. */
  private static final class InMemoryLockTable implements RdfReindexLockDAO {
    private final Map<String, RdfReindexLockRecord> rows = new HashMap<>();

    @Override
    public int insertIfNotExists(
        final String lockKey,
        final String jobId,
        final String serverId,
        final long acquiredAt,
        final long lastHeartbeat,
        final long expiresAt) {
      final boolean inserted = !rows.containsKey(lockKey);
      if (inserted) {
        rows.put(
            lockKey,
            new RdfReindexLockRecord(
                lockKey, jobId, serverId, acquiredAt, lastHeartbeat, expiresAt));
      }
      return inserted ? 1 : 0;
    }

    @Override
    public int updateHeartbeat(
        final String lockKey, final String jobId, final long lastHeartbeat, final long expiresAt) {
      final RdfReindexLockRecord row = rows.get(lockKey);
      final boolean held = row != null && row.jobId().equals(jobId);
      if (held) {
        rows.put(
            lockKey,
            new RdfReindexLockRecord(
                lockKey, jobId, row.serverId(), row.acquiredAt(), lastHeartbeat, expiresAt));
      }
      return held ? 1 : 0;
    }

    @Override
    public RdfReindexLockRecord findByKey(final String lockKey) {
      return rows.get(lockKey);
    }

    @Override
    public void delete(final String lockKey) {
      rows.remove(lockKey);
    }

    @Override
    public int deleteByKeyAndJob(final String lockKey, final String jobId) {
      final RdfReindexLockRecord row = rows.get(lockKey);
      final boolean held = row != null && row.jobId().equals(jobId);
      if (held) {
        rows.remove(lockKey);
      }
      return held ? 1 : 0;
    }

    @Override
    public int deleteExpiredLocks(final long now) {
      final int before = rows.size();
      rows.values().removeIf(row -> row.expiresAt() < now);
      return before - rows.size();
    }

    void expireAll() {
      rows.replaceAll(
          (key, row) ->
              new RdfReindexLockRecord(
                  key, row.jobId(), row.serverId(), row.acquiredAt(), row.lastHeartbeat(), 0));
    }
  }
}
