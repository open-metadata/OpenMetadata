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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

/**
 * Behavioural tests for {@link DeadlockRetry}. The exception shape mirrors production: a runtime
 * exception (Flowable / MyBatis {@code PersistenceException}) wrapping a {@link SQLException} whose
 * cause chain carries the MySQL deadlock (errno 1213). A bare checked {@code SQLException} cannot
 * escape a {@code Supplier}/{@code Runnable}, so it would never exercise the real path.
 */
class DeadlockRetryTest {

  private static final int MAX_ATTEMPTS = 4;

  private static RuntimeException deadlock() {
    SQLException sql =
        new SQLException(
            "Deadlock found when trying to get lock; try restarting transaction", "40001", 1213);
    return new RuntimeException("### Error updating database", sql);
  }

  @Test
  void executeReturnsWithoutRetryOnSuccess() {
    AtomicInteger calls = new AtomicInteger();
    String result =
        DeadlockRetry.execute(
            () -> {
              calls.incrementAndGet();
              return "ok";
            });
    assertEquals("ok", result);
    assertEquals(1, calls.get(), "no retry on the happy path");
  }

  @Test
  void executeRetriesDeadlockThenSucceeds() {
    AtomicInteger calls = new AtomicInteger();
    String result =
        DeadlockRetry.execute(
            () -> {
              if (calls.incrementAndGet() < 3) {
                throw deadlock();
              }
              return "ok";
            });
    assertEquals("ok", result);
    assertEquals(3, calls.get(), "replays until the deadlock clears");
  }

  @Test
  void executeDoesNotRetryNonDeadlock() {
    AtomicInteger calls = new AtomicInteger();
    IllegalStateException boom = new IllegalStateException("not a deadlock");
    IllegalStateException thrown =
        assertThrows(
            IllegalStateException.class,
            () ->
                DeadlockRetry.execute(
                    () -> {
                      calls.incrementAndGet();
                      throw boom;
                    }));
    assertSame(boom, thrown, "non-deadlock errors propagate unchanged");
    assertEquals(1, calls.get(), "no retry for a non-deadlock error");
  }

  @Test
  void executeStopsAfterMaxAttemptsWhenDeadlockPersists() {
    AtomicInteger calls = new AtomicInteger();
    assertThrows(
        RuntimeException.class,
        () ->
            DeadlockRetry.execute(
                () -> {
                  calls.incrementAndGet();
                  throw deadlock();
                }));
    assertEquals(MAX_ATTEMPTS, calls.get(), "bounded at the configured max attempts");
  }

  @Test
  void runReplaysVoidCommandOnDeadlock() {
    AtomicInteger calls = new AtomicInteger();
    DeadlockRetry.run(
        () -> {
          if (calls.incrementAndGet() < 2) {
            throw deadlock();
          }
        });
    assertEquals(2, calls.get(), "void command replays once then commits");
  }

  @Test
  void isDeadlockRecognisesRetryableCodesAndMessage() {
    assertTrue(DeadlockRetry.isDeadlock(deadlock()), "errno 1213 in the cause chain");
    assertTrue(
        DeadlockRetry.isDeadlock(new SQLException("lock wait timeout", "HY000", 1205)),
        "MySQL lock-wait timeout");
    assertTrue(
        DeadlockRetry.isDeadlock(new SQLException("deadlock detected", "40P01")),
        "Postgres deadlock SQLState");
    assertTrue(
        DeadlockRetry.isDeadlock(
            new RuntimeException("Deadlock found when trying to get lock; try restarting")),
        "message match without a SQLException");
    assertFalse(DeadlockRetry.isDeadlock(new IllegalStateException("unrelated")), "not a deadlock");
    assertFalse(DeadlockRetry.isDeadlock(null), "null is not a deadlock");
  }
}
