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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import org.jdbi.v3.core.transaction.TransactionException;
import org.junit.jupiter.api.Test;

class TransactionRollbackTrackerTest {

  @Test
  void anAttemptWhoseTransactionWasRolledBackFailsWithAReplayableError() {
    TransactionException refused =
        assertThrows(
            TransactionException.class,
            () ->
                TransactionRollbackTracker.runAttempt(
                    () -> {
                      TransactionRollbackTracker.recordRollback(deadlock());
                      return "caught and carried on";
                    }));

    assertTrue(DeadlockRetry.isDeadlock(refused), "DeadlockRetry must replay the attempt");
    assertTrue(
        refused.getMessage().contains("Deadlock found when trying to get lock"),
        "the database's message must reach the caller");
  }

  @Test
  void anAttemptWithoutARollbackReturnsItsResult() {
    assertEquals("done", TransactionRollbackTracker.runAttempt(() -> "done"));
  }

  @Test
  void aRollbackOutsideAnAttemptIsNotCarriedIntoTheNextOne() {
    TransactionRollbackTracker.recordRollback(deadlock());

    assertEquals("clean", TransactionRollbackTracker.runAttempt(() -> "clean"));
  }

  @Test
  void aFailingBodyIsRethrownUnchanged() {
    RuntimeException thrown = new RuntimeException("### Error updating database", deadlock());

    assertSame(
        thrown,
        assertThrows(
            RuntimeException.class,
            () ->
                TransactionRollbackTracker.runAttempt(
                    () -> {
                      TransactionRollbackTracker.recordRollback(deadlock());
                      throw thrown;
                    })));
  }

  @Test
  void aNestedAttemptLeavesTheEnclosingOneTracking() {
    assertThrows(
        TransactionException.class,
        () ->
            TransactionRollbackTracker.runAttempt(
                () -> {
                  TransactionRollbackTracker.runAttempt(() -> "inner");
                  TransactionRollbackTracker.recordRollback(deadlock());
                  return "outer";
                }));
  }

  @Test
  void aRollbackSwallowedInsideANestedAttemptFailsTheEnclosingOne() {
    assertThrows(
        TransactionException.class,
        () ->
            TransactionRollbackTracker.runAttempt(
                () -> {
                  try {
                    TransactionRollbackTracker.runAttempt(
                        () -> {
                          TransactionRollbackTracker.recordRollback(deadlock());
                          return "inner";
                        });
                  } catch (TransactionException swallowed) {
                    // A nested boundary that gives up, or a caller that catches its failure.
                  }
                  return "outer";
                }));
  }

  private static SQLException deadlock() {
    return new SQLException(
        "Deadlock found when trying to get lock; try restarting transaction", "40001", 1213);
  }
}
