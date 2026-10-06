package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class BatchParallelismTest {
  private static final String NODE = "checkNode";
  private static final int BOUND = 4;
  private static final List<String> LINKS =
      IntStream.range(0, 300).mapToObj("<#E::table::svc.db.schema.t%03d>"::formatted).toList();

  /** Keeps every third entity, waiting a moment on some so the pool finishes out of order. */
  private static final Predicate<String> EVERY_THIRD =
      entityLink -> {
        int index = indexOf(entityLink);
        if (index % 7 == 0) {
          awaitQuietly(new CountDownLatch(1), 2);
        }
        return index % 3 == 0;
      };

  @Test
  void parallelEvaluationKeepsTheSerialResultAndOrder() {
    BatchEntities.ConditionOutcome serial =
        BatchEntities.evaluate(NODE, LINKS, "true", EVERY_THIRD, BatchParallelism.Budget.of(1));
    BatchEntities.ConditionOutcome parallel =
        BatchEntities.evaluate(NODE, LINKS, "true", EVERY_THIRD, BatchParallelism.Budget.of(BOUND));

    assertEquals(100, parallel.continuing().size());
    assertEquals(serial.continuing(), parallel.continuing());
    assertEquals(serial.result(), parallel.result());
  }

  @Test
  void parallelActionsKeepTheBatchOrder() {
    Set<String> touched = ConcurrentHashMap.newKeySet();
    BatchEntities.ActionOutcome outcome =
        BatchEntities.apply(NODE, LINKS, touched::add, BatchParallelism.Budget.of(BOUND));

    assertEquals(LINKS, outcome.applied());
    assertEquals(Set.copyOf(LINKS), touched);
  }

  @Test
  void failingEntitiesLeaveTheBatchAndTheRestGoOn() {
    Predicate<String> failsEveryTenth =
        entityLink -> {
          if (indexOf(entityLink) % 10 == 0) {
            throw new IllegalStateException("no access to %s".formatted(entityLink));
          }
          return true;
        };

    BatchEntities.ConditionOutcome outcome =
        BatchEntities.evaluate(
            NODE, LINKS, "true", failsEveryTenth, BatchParallelism.Budget.of(BOUND));

    assertEquals(270, outcome.continuing().size());
    assertTrue(outcome.continuing().stream().noneMatch(link -> indexOf(link) % 10 == 0));
    String summary = outcome.failures().summary();
    assertTrue(summary.contains("failed for 30 of 300"), summary);
    assertTrue(summary.contains("(+10 more)"), summary);
    assertTrue(
        summary.startsWith(
            "Node 'checkNode' failed for 30 of 300 entities of the batch: " + LINKS.getFirst()),
        summary);
  }

  @Test
  void concurrencyNeverExceedsTheBoundAndReachesIt() {
    AtomicInteger inFlight = new AtomicInteger();
    AtomicInteger maxInFlight = new AtomicInteger();
    CountDownLatch allWorkersBusy = new CountDownLatch(BOUND);

    BatchParallelism.run(
        NODE,
        LINKS,
        entityLink -> {
          maxInFlight.accumulateAndGet(inFlight.incrementAndGet(), Math::max);
          allWorkersBusy.countDown();
          awaitQuietly(allWorkersBusy, 5_000);
          inFlight.decrementAndGet();
          return true;
        },
        BatchParallelism.Budget.of(BOUND));

    assertEquals(BOUND, maxInFlight.get());
  }

  @Test
  void runsSharingABudgetTogetherStayWithinIt() throws InterruptedException {
    BatchParallelism.Budget shared = BatchParallelism.Budget.of(BOUND);
    AtomicInteger inFlight = new AtomicInteger();
    AtomicInteger maxInFlight = new AtomicInteger();
    Predicate<String> tracked =
        entityLink -> {
          maxInFlight.accumulateAndGet(inFlight.incrementAndGet(), Math::max);
          awaitQuietly(new CountDownLatch(1), 1);
          inFlight.decrementAndGet();
          return true;
        };

    Thread other =
        Thread.ofPlatform()
            .start(() -> BatchEntities.evaluate(NODE, LINKS, "true", tracked, shared));
    BatchEntities.evaluate(NODE, LINKS, "true", tracked, shared);
    other.join();

    assertTrue(maxInFlight.get() <= BOUND, "max in flight " + maxInFlight.get());
    assertEquals(BOUND, shared.permits().availablePermits());
  }

  @Test
  void thePoolIsClosedWhenTheRunReturns() throws InterruptedException {
    Set<Thread> workers = ConcurrentHashMap.newKeySet();
    BatchParallelism.run(
        NODE,
        LINKS,
        entityLink -> {
          workers.add(Thread.currentThread());
          return true;
        },
        BatchParallelism.Budget.of(BOUND));

    assertFalse(workers.isEmpty());
    for (Thread worker : workers) {
      assertTrue(worker.getName().startsWith(BatchParallelism.THREAD_NAME_PREFIX + NODE));
      worker.join(TimeUnit.SECONDS.toMillis(5));
      assertFalse(worker.isAlive(), worker.getName());
    }
  }

  @Test
  void thePoolIsClosedWhenAnErrorEscapesTheWork() throws InterruptedException {
    Set<Thread> workers = ConcurrentHashMap.newKeySet();
    AssertionError error = new AssertionError("broken");

    AssertionError thrown =
        assertThrows(
            AssertionError.class,
            () ->
                BatchParallelism.run(
                    NODE,
                    LINKS,
                    entityLink -> {
                      workers.add(Thread.currentThread());
                      if (indexOf(entityLink) == 5) {
                        throw error;
                      }
                      return true;
                    },
                    BatchParallelism.Budget.of(BOUND)));

    assertSame(error, thrown);
    for (Thread worker : workers) {
      worker.join(TimeUnit.SECONDS.toMillis(5));
      assertFalse(worker.isAlive(), worker.getName());
    }
  }

  @Test
  void anEntityListedTwiceIsHandledOnce() {
    Map<String, AtomicInteger> calls = new ConcurrentHashMap<>();
    List<String> links = List.of(LINKS.get(0), LINKS.get(1), LINKS.get(0), LINKS.get(2));

    BatchEntities.ActionOutcome outcome =
        BatchEntities.apply(
            NODE,
            links,
            entityLink ->
                calls.computeIfAbsent(entityLink, key -> new AtomicInteger()).incrementAndGet(),
            BatchParallelism.Budget.of(BOUND));

    assertEquals(links, outcome.applied());
    assertEquals(1, calls.get(LINKS.get(0)).get());
    assertEquals(3, calls.size());
  }

  @Test
  void theBudgetIsAQuarterOfTheDatabasePoolCappedAtEight() {
    assertEquals(8, BatchParallelism.threadsFor(100));
    assertEquals(5, BatchParallelism.threadsFor(20));
    assertEquals(1, BatchParallelism.threadsFor(3));
    assertEquals(1, BatchParallelism.threadsFor(0));
  }

  @Test
  void withoutAServerConfigurationTheWorkRunsOnTheCallingThread() {
    Thread caller = Thread.currentThread();
    Set<Thread> threads = ConcurrentHashMap.newKeySet();

    BatchParallelism.run(
        NODE,
        LINKS,
        entityLink -> {
          threads.add(Thread.currentThread());
          return true;
        });

    assertEquals(Set.of(caller), threads);
  }

  private static int indexOf(String entityLink) {
    return Integer.parseInt(
        entityLink.substring(entityLink.lastIndexOf('t') + 1, entityLink.length() - 1));
  }

  private static void awaitQuietly(CountDownLatch latch, long millis) {
    try {
      latch.await(millis, TimeUnit.MILLISECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
