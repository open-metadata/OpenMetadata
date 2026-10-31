package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.apache.hc.core5.util.Deadline;
import org.apache.hc.core5.util.DeadlineTimeoutException;
import org.junit.jupiter.api.Test;

class BulkAttemptTest {

  @Test
  void retriesKeepTheDeadlineSetAtTheFirstSend() {
    BulkAttempt<String> first =
        BulkAttempt.first(List.of("a", "b"), 7L, new BulkRetryPolicy(3, 100, 1_000, 60_000));

    BulkAttempt<String> thirdSend = first.next().next();

    assertEquals(2, thirdSend.attemptNumber());
    assertEquals(7L, thirdSend.executionId());
    assertEquals(2, thirdSend.size());
    assertEquals(first.deadlineMillis(), thirdSend.deadlineMillis());
  }

  @Test
  void aWaitIsAllowedOnlyIfItEndsBeforeTheDeadline() {
    BulkAttempt<String> attempt =
        BulkAttempt.first(List.of("a"), 1L, new BulkRetryPolicy(3, 100, 1_000, 60_000));

    assertFalse(attempt.hasExpired());
    assertTrue(attempt.outlasts(1_000));
    assertFalse(attempt.outlasts(120_000));
  }

  @Test
  void aZeroLifetimeExpiresAtTheFirstSend() {
    BulkAttempt<String> attempt =
        BulkAttempt.first(List.of("a"), 1L, new BulkRetryPolicy(3, 100, 1_000, 0));

    assertTrue(attempt.hasExpired());
    assertFalse(attempt.outlasts(0));
  }

  @Test
  void aFreshBulkIsNotYetCounted() {
    BulkAttempt<String> attempt =
        BulkAttempt.first(List.of("a"), 1L, new BulkRetryPolicy(3, 100, 1_000, 60_000));

    assertFalse(attempt.bulkAlreadyCounted());
  }

  @Test
  void nextAfterFailureMarksTheBulkCountedOnlyForRealClusterErrors() {
    BulkAttempt<String> attempt =
        BulkAttempt.first(List.of("a"), 1L, new BulkRetryPolicy(3, 100, 1_000, 60_000));

    // A pool-wait timeout never reaches the cluster, so the retry is still the bulk's first
    // verdict.
    BulkAttempt<String> afterPoolWait = attempt.nextAfterFailure(poolWaitTimeout());
    assertFalse(afterPoolWait.bulkAlreadyCounted());
    assertEquals(1, afterPoolWait.attemptNumber());
    assertEquals(attempt.deadlineMillis(), afterPoolWait.deadlineMillis());

    // A real cluster error is the bulk's one verdict; the retry is marked counted.
    BulkAttempt<String> afterReal =
        afterPoolWait.nextAfterFailure(new RuntimeException("es_rejected_execution_exception"));
    assertTrue(afterReal.bulkAlreadyCounted());
    assertEquals(2, afterReal.attemptNumber());

    // Once counted, even a later pool-wait keeps the bulk marked counted (memory is not reset).
    BulkAttempt<String> afterPoolWaitAgain = afterReal.nextAfterFailure(poolWaitTimeout());
    assertTrue(afterPoolWaitAgain.bulkAlreadyCounted());

    // And a later real retry stays counted (one bulk's retries cannot re-count).
    BulkAttempt<String> afterRealAgain =
        afterPoolWaitAgain.nextAfterFailure(new RuntimeException("circuit_breaking_exception"));
    assertTrue(afterRealAgain.bulkAlreadyCounted());
  }

  @Test
  void nextPreservesTheBulkCountedFlagForPauses() {
    BulkAttempt<String> counted =
        BulkAttempt.first(List.of("a"), 1L, new BulkRetryPolicy(3, 100, 1_000, 60_000))
            .nextAfterFailure(new RuntimeException("too_many_requests"));

    assertTrue(counted.next().bulkAlreadyCounted());
  }

  private static DeadlineTimeoutException poolWaitTimeout() {
    return DeadlineTimeoutException.from(
        Deadline.fromUnixMilliseconds(System.currentTimeMillis() - 100));
  }
}
