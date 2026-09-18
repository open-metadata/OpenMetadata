/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 */

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.jdbi3.EntityRepository.enterRetryableBoundary;
import static org.openmetadata.service.jdbi3.EntityRepository.exitRetryableBoundary;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * The nesting guard that decides which transaction boundary owns the {@link DeadlockRetry}.
 *
 * <p>JDBI joins a nested {@code inTransaction} to the handle already bound to the thread rather than
 * opening a savepoint, so nested boundaries share one database transaction. A deadlock rolls that
 * whole transaction back, so only the outermost boundary may retry — an inner retry would replay its
 * own body against a transaction the database has already discarded and commit a fragment of the
 * unit of work. Nesting is reachable in production: a hard delete runs {@code entitySpecificCleanup}
 * inside its boundary, and those hooks cascade into full entity deletes of their own.
 */
class RetryableBoundaryTest {

  @AfterEach
  void clearBoundary() {
    // A leaked flag would silently disable the retry for every later test on this thread.
    exitRetryableBoundary(true);
  }

  @Test
  void outermostCallOwnsTheRetry() {
    assertTrue(enterRetryableBoundary(), "the first boundary on a clean thread owns the retry");
  }

  @Test
  void nestedCallDoesNotOwnTheRetry() {
    assertTrue(enterRetryableBoundary());
    assertFalse(enterRetryableBoundary(), "a boundary opened inside another must not retry");
    assertFalse(enterRetryableBoundary(), "nesting deeper still must not retry");
  }

  @Test
  void leavingANestedCallKeepsTheOuterBoundaryOpen() {
    assertTrue(enterRetryableBoundary());
    boolean nested = enterRetryableBoundary();
    exitRetryableBoundary(nested);
    assertFalse(
        enterRetryableBoundary(), "the outer boundary is still open, so this is still nested");
  }

  @Test
  void leavingTheOutermostCallReopensTheThread() {
    boolean owner = enterRetryableBoundary();
    exitRetryableBoundary(owner);
    assertTrue(enterRetryableBoundary(), "the next request on a pooled thread retries again");
  }

  @Test
  void anExceptionInsideTheBoundaryDoesNotStrandTheFlag() {
    boolean owner = enterRetryableBoundary();
    try {
      throw new IllegalStateException("flush blew up");
    } catch (IllegalStateException expected) {
      exitRetryableBoundary(owner);
    }
    assertTrue(enterRetryableBoundary(), "a failed flush must not disable retry for the thread");
  }

  @Test
  void boundariesAreIndependentPerThread() throws Exception {
    assertTrue(enterRetryableBoundary());
    ExecutorService executor = Executors.newSingleThreadExecutor();
    try {
      // A boundary open on the request thread says nothing about a worker thread, which checks out
      // its own connection and so owns its own transaction.
      Callable<Boolean> openOnWorker = EntityRepository::enterRetryableBoundary;
      Future<Boolean> onOtherThread = executor.submit(openOnWorker);
      assertTrue(onOtherThread.get(), "another thread has its own transaction and its own retry");
    } finally {
      executor.shutdownNow();
    }
  }
}
