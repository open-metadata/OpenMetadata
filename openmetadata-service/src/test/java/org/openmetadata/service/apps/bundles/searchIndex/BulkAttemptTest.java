package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
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
}
