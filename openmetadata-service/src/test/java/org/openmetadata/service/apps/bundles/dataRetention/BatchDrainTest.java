package org.openmetadata.service.apps.bundles.dataRetention;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntPredicate;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class BatchDrainTest {

  private static final int BATCH_SIZE = 10;
  private static final IntPredicate DRAINED_WHEN_UNDER_A_BATCH = deleted -> deleted < BATCH_SIZE;
  private static final IntPredicate DRAINED_WHEN_NOTHING_LEFT = deleted -> deleted == 0;

  /** A delete that hands back {@code available} rows, a batch at a time. */
  private static Supplier<Integer> deleterWith(AtomicInteger available) {
    return () -> {
      int deleted = Math.min(BATCH_SIZE, available.get());
      available.addAndGet(-deleted);
      return deleted;
    };
  }

  @Test
  void drainsUntilABatchComesBackShort() {
    AtomicInteger available = new AtomicInteger(25);

    BatchDrain.Result result =
        BatchDrain.drain(deleterWith(available), DRAINED_WHEN_UNDER_A_BATCH, BATCH_SIZE);

    assertEquals(25, result.deleted());
    assertEquals(0, result.failed());
    assertFalse(result.hitIterationCap());
    assertNull(result.failure());
  }

  @Test
  void drainsUntilABatchComesBackEmpty() {
    AtomicInteger available = new AtomicInteger(30);

    BatchDrain.Result result =
        BatchDrain.drain(deleterWith(available), DRAINED_WHEN_NOTHING_LEFT, BATCH_SIZE);

    assertEquals(30, result.deleted());
    assertFalse(result.hitIterationCap());
  }

  /**
   * The failure gitar-bot flagged on the extension path: a deleter that ignores the batch size it
   * was handed and always claims a full one. Before the cap this spun forever and took the whole
   * scheduled job with it.
   */
  @Test
  void aDeleterThatNeverReportsAShortBatchStopsAtTheIterationCap() {
    AtomicInteger calls = new AtomicInteger();

    BatchDrain.Result result =
        BatchDrain.drain(
            () -> {
              calls.incrementAndGet();
              return BATCH_SIZE;
            },
            DRAINED_WHEN_UNDER_A_BATCH,
            BATCH_SIZE);

    assertEquals(BatchDrain.MAX_ITERATIONS, calls.get());
    assertEquals(BatchDrain.MAX_ITERATIONS * BATCH_SIZE, result.deleted());
    assertTrue(result.hitIterationCap());
    assertNull(result.failure());
  }

  @Test
  void aThrowingDeleterStopsTheDrainAndIsReported() {
    RuntimeException failure = new IllegalStateException("the delete blew up");
    AtomicInteger calls = new AtomicInteger();

    BatchDrain.Result result =
        BatchDrain.drain(
            () -> {
              if (calls.incrementAndGet() > 1) {
                throw failure;
              }
              return BATCH_SIZE;
            },
            DRAINED_WHEN_UNDER_A_BATCH,
            BATCH_SIZE);

    assertEquals(2, calls.get());
    assertEquals(BATCH_SIZE, result.deleted());
    assertEquals(BATCH_SIZE, result.failed());
    assertSame(failure, result.failure());
    assertFalse(
        result.hitIterationCap(), "a failure is not the cap, and must not be warned as one");
  }

  /** A half-deployed extension throws NoClassDefFoundError, which is an Error, not an Exception. */
  @Test
  void aDeleterMissingADependencyIsCaughtToo() {
    Error failure = new NoClassDefFoundError("com/example/MissingDao");

    BatchDrain.Result result =
        BatchDrain.drain(
            () -> {
              throw failure;
            },
            DRAINED_WHEN_UNDER_A_BATCH,
            BATCH_SIZE);

    assertEquals(0, result.deleted());
    assertSame(failure, result.failure());
  }
}
