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

import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.InMemoryRdfReindexLockDAO;

class InferenceRunLockTest {
  private final InMemoryRdfReindexLockDAO locks = new InMemoryRdfReindexLockDAO();
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
}
