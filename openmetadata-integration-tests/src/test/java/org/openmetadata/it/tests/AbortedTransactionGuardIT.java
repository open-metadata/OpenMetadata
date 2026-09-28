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

import static java.util.concurrent.TimeUnit.MINUTES;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.JdbiException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.service.Entity;

/**
 * A real deadlock against the server's own Jdbi: two transactions lock two rows in opposite
 * orders, and the one the database rolls back swallows the error and writes anyway, the way a
 * best-effort cleanup step does. MySQL runs that write in a fresh transaction, so without the
 * guard it would be committed while the rest of its unit of work was rolled back. A MySQL lock
 * wait timeout is the opposite case: it rolls back only the statement, so the rest must commit.
 */
@Execution(ExecutionMode.CONCURRENT)
class AbortedTransactionGuardIT {
  private static final String TABLE =
      "it_aborted_txn_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);

  private record Outcome(String marker, boolean lostDeadlock, boolean transactionFailed) {}

  @BeforeAll
  static void createRows() {
    jdbi()
        .useHandle(
            handle -> {
              handle.execute("CREATE TABLE " + TABLE + " (id VARCHAR(64) PRIMARY KEY)");
              handle.execute("INSERT INTO " + TABLE + " (id) VALUES ('left'), ('right'), ('held')");
            });
  }

  @AfterAll
  static void dropRows() {
    jdbi().useHandle(handle -> handle.execute("DROP TABLE " + TABLE));
  }

  @Test
  void theLoserOfADeadlockCommitsNothingItRanAfterSwallowingIt() throws Exception {
    CyclicBarrier bothHoldOneRow = new CyclicBarrier(2);
    ExecutorService workers = Executors.newFixedThreadPool(2);
    try {
      Future<Outcome> left =
          workers.submit(() -> lockBothThenWrite("left", "right", bothHoldOneRow));
      Future<Outcome> right =
          workers.submit(() -> lockBothThenWrite("right", "left", bothHoldOneRow));
      List<Outcome> outcomes = List.of(left.get(2, MINUTES), right.get(2, MINUTES));

      Outcome loser = only(outcomes, Outcome::lostDeadlock);
      Outcome winner = only(outcomes, outcome -> !outcome.lostDeadlock());
      assertTrue(loser.transactionFailed(), "the rolled-back transaction must not commit");
      assertFalse(winner.transactionFailed(), "the surviving transaction must commit");
      assertEquals(Set.of(winner.marker()), markers("written-%"));
    } finally {
      workers.shutdownNow();
    }
  }

  @Test
  void aLockWaitTimeoutLeavesTheRestOfTheTransactionToCommit() throws SQLException {
    assumeTrue(isMySql(), "only MySQL gives up on a lock wait by default");
    try (Handle holder = jdbi().open();
        Handle waiter = jdbi().open()) {
      holder.begin();
      lock(holder, "held");
      waiter.execute("SET SESSION innodb_lock_wait_timeout = 1");
      try {
        waiter.useTransaction(
            transaction -> {
              transaction.execute("INSERT INTO " + TABLE + " (id) VALUES ('timeout-before')");
              assertFalse(tryLock(transaction, "held"), "the lock wait must time out");
              transaction.execute("INSERT INTO " + TABLE + " (id) VALUES ('timeout-after')");
            });
      } finally {
        waiter.execute("SET SESSION innodb_lock_wait_timeout = DEFAULT");
        holder.rollback();
      }
    }
    assertEquals(Set.of("timeout-before", "timeout-after"), markers("timeout-%"));
  }

  private static boolean isMySql() throws SQLException {
    try (Handle handle = jdbi().open()) {
      return handle.getConnection().getMetaData().getDatabaseProductName().contains("MySQL");
    }
  }

  private static Outcome lockBothThenWrite(String first, String second, CyclicBarrier barrier)
      throws Exception {
    String marker = "written-after-" + first;
    AtomicBoolean lostDeadlock = new AtomicBoolean();
    boolean transactionFailed = false;
    try (Handle handle = jdbi().open()) {
      try {
        handle.useTransaction(
            transaction -> {
              lock(transaction, first);
              barrier.await(1, MINUTES);
              lostDeadlock.set(!tryLock(transaction, second));
              transaction.execute("INSERT INTO " + TABLE + " (id) VALUES (?)", marker);
            });
      } catch (JdbiException failure) {
        transactionFailed = true;
      }
      assertEquals(
          1,
          handle.createQuery("SELECT 1").mapTo(Integer.class).one(),
          "the connection must survive a refused commit");
    }
    return new Outcome(marker, lostDeadlock.get(), transactionFailed);
  }

  private static boolean tryLock(Handle handle, String id) {
    try {
      lock(handle, id);
      return true;
    } catch (JdbiException deadlock) {
      return false;
    }
  }

  private static void lock(Handle handle, String id) {
    handle
        .createQuery("SELECT id FROM " + TABLE + " WHERE id = :id FOR UPDATE")
        .bind("id", id)
        .mapTo(String.class)
        .one();
  }

  private static Set<String> markers(String pattern) {
    return jdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT id FROM " + TABLE + " WHERE id LIKE :pattern")
                    .bind("pattern", pattern)
                    .mapTo(String.class)
                    .collect(Collectors.toSet()));
  }

  private static Outcome only(List<Outcome> outcomes, Predicate<Outcome> matching) {
    List<Outcome> matches = outcomes.stream().filter(matching).toList();
    assertEquals(1, matches.size(), "exactly one transaction must lose the deadlock");
    return matches.getFirst();
  }

  private static Jdbi jdbi() {
    return Entity.getJdbi();
  }
}
