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

package org.openmetadata.service.lock;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;

class DatabaseAdvisoryLockTest {
  private static final String LOCK_KEY = "logical-suite:00000000-0000-0000-0000-000000000001";

  @Test
  void executesWhileHoldingAndThenReleasesTheSessionLock() {
    Jdbi jdbi = mock(Jdbi.class);
    Handle handle = mock(Handle.class);
    DatabaseAdvisoryLock.AdvisoryLockDAO lockDAO = mock(DatabaseAdvisoryLock.AdvisoryLockDAO.class);
    AtomicBoolean held = new AtomicBoolean();
    when(jdbi.open()).thenReturn(handle);
    when(handle.attach(DatabaseAdvisoryLock.AdvisoryLockDAO.class)).thenReturn(lockDAO);
    when(lockDAO.tryAcquire(LOCK_KEY))
        .thenAnswer(
            ignored -> {
              held.set(true);
              return true;
            });
    when(lockDAO.release(LOCK_KEY))
        .thenAnswer(
            ignored -> {
              assertTrue(held.get());
              held.set(false);
              return true;
            });

    String result =
        DatabaseAdvisoryLock.withLock(
            jdbi,
            LOCK_KEY,
            Duration.ZERO,
            () -> {
              assertTrue(held.get());
              return "published";
            });

    assertEquals("published", result);
    assertFalse(held.get());
    verify(handle).close();
  }

  @Test
  void releasesTheSessionLockWhenTheOperationFails() {
    Jdbi jdbi = mock(Jdbi.class);
    Handle handle = mock(Handle.class);
    DatabaseAdvisoryLock.AdvisoryLockDAO lockDAO = mock(DatabaseAdvisoryLock.AdvisoryLockDAO.class);
    when(jdbi.open()).thenReturn(handle);
    when(handle.attach(DatabaseAdvisoryLock.AdvisoryLockDAO.class)).thenReturn(lockDAO);
    when(lockDAO.tryAcquire(LOCK_KEY)).thenReturn(true);
    when(lockDAO.release(LOCK_KEY)).thenReturn(true);

    assertThrows(
        IllegalArgumentException.class,
        () ->
            DatabaseAdvisoryLock.withLock(
                jdbi,
                LOCK_KEY,
                Duration.ZERO,
                () -> {
                  throw new IllegalArgumentException("publication failed");
                }));

    verify(lockDAO).release(LOCK_KEY);
    verify(handle).close();
  }

  @Test
  void timesOutWithoutRunningTheOperation() {
    Jdbi jdbi = mock(Jdbi.class);
    Handle handle = mock(Handle.class);
    DatabaseAdvisoryLock.AdvisoryLockDAO lockDAO = mock(DatabaseAdvisoryLock.AdvisoryLockDAO.class);
    AtomicBoolean operationRan = new AtomicBoolean();
    when(jdbi.open()).thenReturn(handle);
    when(handle.attach(DatabaseAdvisoryLock.AdvisoryLockDAO.class)).thenReturn(lockDAO);
    when(lockDAO.tryAcquire(LOCK_KEY)).thenReturn(false);

    assertThrows(
        DatabaseAdvisoryLock.LockUnavailableException.class,
        () ->
            DatabaseAdvisoryLock.withLock(
                jdbi,
                LOCK_KEY,
                Duration.ZERO,
                () -> {
                  operationRan.set(true);
                  return null;
                }));

    assertFalse(operationRan.get());
    verify(lockDAO, never()).release(LOCK_KEY);
    verify(handle).close();
  }
}
