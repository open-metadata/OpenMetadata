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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.rdf.RdfReindexRunLock;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;

/**
 * The lock that keeps two RDF reindex runs apart, against the real rdf_reindex_lock table on MySQL
 * and Postgres. Each test uses its own key, so a real reindex elsewhere in the suite is unaffected.
 */
@Execution(ExecutionMode.CONCURRENT)
public class RdfReindexRunLockIT {
  private RdfReindexLockDAO locks;
  private String lockKey;

  @BeforeEach
  void connect() {
    locks = Entity.getCollectionDAO().rdfReindexLockDAO();
    lockKey = "RdfReindexRunLockIT-" + UUID.randomUUID();
  }

  @AfterEach
  void removeLock() {
    locks.delete(lockKey);
  }

  @Test
  void secondRunIsRefusedAndToldWhichRunHoldsTheLockUntilItIsReleased() {
    final RdfReindexRunLock first = lock("run-1", "server-a");
    first.acquire();

    final IllegalStateException refused =
        assertThrows(IllegalStateException.class, lock("run-2", "server-b")::acquire);

    assertTrue(refused.getMessage().contains("server 'server-a'"), refused.getMessage());
    assertTrue(refused.getMessage().contains("run-1"), refused.getMessage());
    first.release();
    assertDoesNotThrow(lock("run-2", "server-b")::acquire);
  }

  @Test
  void lockOfARunWhoseServerStoppedIsTakenOverOnceItExpires() {
    final long longAgo = System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(10);
    locks.tryAcquireLock(
        lockKey, "stopped-run", "stopped-server", longAgo, longAgo + RdfReindexRunLock.EXPIRY_MS);

    assertDoesNotThrow(lock("run-2", "server-b")::acquire);
  }

  @Test
  void releaseByARunThatDoesNotHoldTheLockLeavesTheHolderInPlace() {
    lock("run-1", "server-a").acquire();

    lock("run-2", "server-b").release();

    assertThrows(IllegalStateException.class, lock("run-3", "server-c")::acquire);
  }

  @Test
  void renewalPushesTheExpiryForward() throws InterruptedException {
    final RdfReindexRunLock holder = lock("run-1", "server-a");
    holder.acquire();
    final long firstExpiry = locks.findByKey(lockKey).expiresAt();
    TimeUnit.MILLISECONDS.sleep(5);

    holder.renew();

    assertTrue(locks.findByKey(lockKey).expiresAt() > firstExpiry);
  }

  private RdfReindexRunLock lock(final String runId, final String serverId) {
    return new RdfReindexRunLock(locks, lockKey, runId, serverId);
  }
}
