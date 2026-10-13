package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class BatchParallelismTest {
  private static final String NODE = "checkNode";
  private static final int BOUND = 4;
  private static final long WAIT_SECONDS = 10;
  private static final List<String> LINKS =
      IntStream.range(0, 300).mapToObj("<#E::table::svc.db.schema.t%03d>"::formatted).toList();

  private static final Predicate<String> EVERY_THIRD = entityLink -> indexOf(entityLink) % 3 == 0;

  @Test
  void parallelEvaluationKeepsTheSerialResultAndOrder() {
    ReversedGroups reversed = new ReversedGroups(LINKS.size(), BOUND);

    BatchEntities.ConditionOutcome serial =
        BatchEntities.evaluate(NODE, LINKS, "true", EVERY_THIRD, BatchParallelism.Budget.of(1));
    BatchEntities.ConditionOutcome parallel =
        BatchEntities.evaluate(
            NODE, LINKS, "true", reversed.gate(EVERY_THIRD), BatchParallelism.Budget.of(BOUND));

    assertEquals(reversed.expectedCompletionOrder(), reversed.completionOrder());
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
          awaitOrFail(allWorkersBusy);
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
    CountDownLatch boundReached = new CountDownLatch(BOUND);
    CountDownLatch release = new CountDownLatch(1);
    Predicate<String> tracked =
        entityLink -> {
          maxInFlight.accumulateAndGet(inFlight.incrementAndGet(), Math::max);
          boundReached.countDown();
          awaitOrFail(release);
          inFlight.decrementAndGet();
          return true;
        };

    Thread first =
        Thread.ofPlatform()
            .start(() -> BatchEntities.evaluate(NODE, LINKS, "true", tracked, shared));
    Thread second =
        Thread.ofPlatform()
            .start(() -> BatchEntities.evaluate(NODE, LINKS, "true", tracked, shared));
    awaitOrFail(boundReached);
    // Each run starts BOUND workers; those of both runs that hold no permit queue for one.
    await()
        .atMost(WAIT_SECONDS, TimeUnit.SECONDS)
        .until(() -> shared.permits().getQueueLength() == BOUND);
    int inFlightWhileTheOthersWait = inFlight.get();
    release.countDown();
    first.join(TimeUnit.SECONDS.toMillis(WAIT_SECONDS));
    second.join(TimeUnit.SECONDS.toMillis(WAIT_SECONDS));

    assertEquals(BOUND, inFlightWhileTheOthersWait);
    assertEquals(BOUND, maxInFlight.get());
    assertEquals(BOUND, shared.permits().availablePermits());
  }

  @Test
  void workOnTheCallingThreadHoldsAPermitOfTheBudget() {
    BatchParallelism.Budget budget = BatchParallelism.Budget.of(BOUND);
    BatchParallelism.Budget single = BatchParallelism.Budget.of(1);
    List<Integer> availableWithOneEntity = new ArrayList<>();
    List<Integer> availableWithOneThread = new ArrayList<>();

    BatchParallelism.run(
        NODE,
        List.of(LINKS.getFirst()),
        entityLink -> availableWithOneEntity.add(budget.permits().availablePermits()),
        budget);
    BatchParallelism.run(
        NODE,
        LINKS.subList(0, 3),
        entityLink -> availableWithOneThread.add(single.permits().availablePermits()),
        single);

    assertEquals(List.of(BOUND - 1), availableWithOneEntity);
    assertEquals(List.of(0, 0, 0), availableWithOneThread);
    assertEquals(BOUND, budget.permits().availablePermits());
    assertEquals(1, single.permits().availablePermits());
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

  private static void awaitOrFail(CountDownLatch latch) {
    boolean released;
    try {
      released = latch.await(WAIT_SECONDS, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      released = false;
    }
    if (!released) {
      throw new AssertionError("latch not released within %d s".formatted(WAIT_SECONDS));
    }
  }

  /**
   * Makes a pool of {@code groupSize} threads finish the entities of each consecutive group in
   * reverse order. The pool claims entities in batch order, so a whole group is in flight at once;
   * its last entity waits until every member arrived, and each entity, once done, lets the one
   * before it finish.
   */
  private static final class ReversedGroups {
    private final int groupSize;
    private final List<CountDownLatch> arrivals;
    private final List<CountDownLatch> turns;
    private final Queue<Integer> completionOrder = new ConcurrentLinkedQueue<>();

    ReversedGroups(int entityCount, int groupSize) {
      this.groupSize = groupSize;
      this.arrivals =
          IntStream.range(0, Math.ceilDiv(entityCount, groupSize))
              .mapToObj(group -> new CountDownLatch(groupSize(entityCount, group)))
              .toList();
      this.turns = IntStream.range(0, entityCount).mapToObj(i -> new CountDownLatch(1)).toList();
    }

    private int groupSize(int entityCount, int group) {
      return Math.min(groupSize, entityCount - group * groupSize);
    }

    Predicate<String> gate(Predicate<String> condition) {
      return entityLink -> {
        int index = indexOf(entityLink);
        arrivals.get(index / groupSize).countDown();
        awaitOrFail(isLastOfGroup(index) ? arrivals.get(index / groupSize) : turns.get(index));
        completionOrder.add(index);
        if (index % groupSize > 0) {
          turns.get(index - 1).countDown();
        }
        return condition.test(entityLink);
      };
    }

    private boolean isLastOfGroup(int index) {
      return index % groupSize == groupSize - 1 || index == turns.size() - 1;
    }

    List<Integer> expectedCompletionOrder() {
      List<Integer> expected = new ArrayList<>();
      for (int start = 0; start < turns.size(); start += groupSize) {
        for (int index = Math.min(start + groupSize, turns.size()) - 1; index >= start; index--) {
          expected.add(index);
        }
      }
      return expected;
    }

    List<Integer> completionOrder() {
      return List.copyOf(completionOrder);
    }
  }
}
