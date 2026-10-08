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
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.sql.SQLException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
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
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * A real deadlock inside the server's unit-of-work wrapper. Two units lock two rows in opposite
 * orders, and the one the database rolls back swallows the error and keeps writing, the way a
 * best-effort cleanup step does. MySQL runs those writes in a fresh transaction, so the wrapper must
 * replay the unit rather than commit only the part after the deadlock. A MySQL lock wait timeout is
 * the opposite case: it rolls back only the statement, so the unit commits.
 */
@Execution(ExecutionMode.CONCURRENT)
class UnitOfWorkRollbackIT {
  private static final String TABLE =
      "it_unit_of_work_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);

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
  void aUnitThatSwallowsItsDeadlockIsReplayedWholeInsteadOfCommittedInPart() throws Exception {
    CyclicBarrier bothHoldOneRow = new CyclicBarrier(2);
    CountDownLatch winnerCommitted = new CountDownLatch(1);
    ExecutorService workers = Executors.newFixedThreadPool(2);
    try {
      Future<Integer> left =
          workers.submit(() -> runUnit("left", "right", bothHoldOneRow, winnerCommitted));
      Future<Integer> right =
          workers.submit(() -> runUnit("right", "left", bothHoldOneRow, winnerCommitted));
      List<Integer> attempts = List.of(left.get(2, MINUTES), right.get(2, MINUTES));

      assertEquals(
          List.of(1, 2), attempts.stream().sorted().toList(), "only the losing unit replays");
      assertEquals(
          Set.of("before-left", "after-left", "before-right", "after-right"),
          union(markers("before-%"), markers("after-%")),
          "both units must be committed whole");
    } finally {
      workers.shutdownNow();
    }
  }

  @Test
  void aLockWaitTimeoutLeavesTheRestOfTheUnitToCommit() throws SQLException {
    assumeTrue(isMySql(), "only MySQL gives up on a lock wait by default");
    try (Handle holder = jdbi().open()) {
      holder.begin();
      lock(holder, "held");
      try {
        assertEquals(1, runUnitThatTimesOut(), "a lock wait timeout must not replay the unit");
      } finally {
        holder.rollback();
      }
    }
    assertEquals(Set.of("timeout-before", "timeout-after"), markers("timeout-%"));
  }

  private static int runUnit(
      String first, String second, CyclicBarrier barrier, CountDownLatch winnerCommitted) {
    AtomicInteger attempts = new AtomicInteger();
    repository()
        .executeInTransaction(
            () -> {
              boolean firstAttempt = attempts.incrementAndGet() == 1;
              if (!firstAttempt) {
                // Postgres wakes the winner but does not grant it the row, so a replay that gets
                // there first locks the row again and deadlocks the winner a second time.
                await(winnerCommitted);
              }
              jdbi()
                  .useHandle(
                      handle -> {
                        write(handle, "before-" + first);
                        lock(handle, first);
                        if (firstAttempt) {
                          await(barrier);
                        }
                        tryLock(handle, second);
                        write(handle, "after-" + first);
                      });
              return null;
            });
    winnerCommitted.countDown();
    return attempts.get();
  }

  private static int runUnitThatTimesOut() {
    AtomicInteger attempts = new AtomicInteger();
    repository()
        .executeInTransaction(
            () -> {
              attempts.incrementAndGet();
              jdbi()
                  .useHandle(
                      handle -> {
                        handle.execute("SET SESSION innodb_lock_wait_timeout = 1");
                        try {
                          write(handle, "timeout-before");
                          assertFalse(tryLock(handle, "held"), "the lock wait must time out");
                          write(handle, "timeout-after");
                        } finally {
                          handle.execute("SET SESSION innodb_lock_wait_timeout = DEFAULT");
                        }
                      });
              return null;
            });
    return attempts.get();
  }

  /** Swallows the failure, the way a best-effort step does. */
  private static boolean tryLock(Handle handle, String id) {
    try {
      lock(handle, id);
      return true;
    } catch (JdbiException lockConflict) {
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

  private static void write(Handle handle, String marker) {
    handle.execute("INSERT INTO " + TABLE + " (id) VALUES (?)", marker);
  }

  private static void await(CyclicBarrier barrier) {
    try {
      barrier.await(1, MINUTES);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("interrupted while both units took their first lock", e);
    } catch (BrokenBarrierException | TimeoutException e) {
      throw new IllegalStateException("both units must hold one row before the deadlock", e);
    }
  }

  private static void await(CountDownLatch winnerCommitted) {
    try {
      if (!winnerCommitted.await(1, MINUTES)) {
        throw new IllegalStateException("the winning unit must commit before the loser replays");
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("interrupted while the winning unit committed", e);
    }
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

  private static Set<String> union(Set<String> first, Set<String> second) {
    Set<String> all = new HashSet<>(first);
    all.addAll(second);
    return all;
  }

  private static boolean isMySql() throws SQLException {
    try (Handle handle = jdbi().open()) {
      return handle.getConnection().getMetaData().getDatabaseProductName().contains("MySQL");
    }
  }

  private static EntityRepository<?> repository() {
    return Entity.getEntityRepository(Entity.TABLE);
  }

  private static Jdbi jdbi() {
    return Entity.getJdbi();
  }
}
