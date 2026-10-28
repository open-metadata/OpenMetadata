package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Locale;
import java.util.concurrent.CompletionException;
import org.apache.hc.core5.util.Deadline;
import org.apache.hc.core5.util.DeadlineTimeoutException;
import org.junit.jupiter.api.Test;

class BulkRetryPolicyTest {

  @Test
  void backoffDoublesFromTheInitialDelayUpToTheCap() {
    BulkRetryPolicy policy = new BulkRetryPolicy(5, 1_000, 10_000);

    assertEquals(1_000, policy.backoffMillis(0));
    assertEquals(2_000, policy.backoffMillis(1));
    assertEquals(4_000, policy.backoffMillis(2));
    assertEquals(8_000, policy.backoffMillis(3));
    assertEquals(10_000, policy.backoffMillis(4));
    assertEquals(10_000, policy.backoffMillis(1_000), "large attempt numbers must not overflow");
  }

  @Test
  void defaultKeepsTheShortBackoffLiveIndexingHasAlwaysUsed() {
    assertEquals(3, BulkRetryPolicy.DEFAULT.maxRetries());
    assertEquals(100, BulkRetryPolicy.DEFAULT.backoffMillis(0));
    assertEquals(400, BulkRetryPolicy.DEFAULT.backoffMillis(2));
  }

  @Test
  void retriesStopOnceTheRetryBudgetIsSpent() {
    BulkRetryPolicy policy = new BulkRetryPolicy(3, 100, 1_000);
    RuntimeException rejection = new RuntimeException("es_rejected_execution_exception");

    assertTrue(policy.shouldRetry(2, rejection));
    assertFalse(policy.shouldRetry(3, rejection));
  }

  @Test
  void waitingForAPooledConnectionIsRetriedEvenThoughItsMessageSaysOnlyOverdue() {
    DeadlineTimeoutException poolWait =
        DeadlineTimeoutException.from(
            Deadline.fromUnixMilliseconds(System.currentTimeMillis() - 100));

    assertFalse(poolWait.getMessage().toLowerCase(Locale.ROOT).contains("timeout"));
    assertTrue(BulkRetryPolicy.DEFAULT.shouldRetry(0, poolWait));
    assertTrue(BulkRetryPolicy.DEFAULT.shouldRetry(0, new CompletionException(poolWait)));
  }

  @Test
  void clusterPushbackIsRetriedButRejectedDocumentsAreNot() {
    BulkRetryPolicy policy = BulkRetryPolicy.DEFAULT;

    assertTrue(policy.shouldRetry(0, new RuntimeException("[es_rejected_execution_exception]")));
    assertTrue(policy.shouldRetry(0, new RuntimeException("status 429 too_many_requests")));
    assertTrue(policy.shouldRetry(0, new RuntimeException("Read timeout")));
    assertTrue(policy.shouldRetry(0, new RuntimeException("Request entity too large")));
    assertTrue(policy.shouldRetry(0, new RuntimeException("circuit_breaking_exception")));
    assertTrue(policy.shouldRetry(0, new RuntimeException((String) null)));
    assertFalse(policy.shouldRetry(0, new RuntimeException("mapper_parsing_exception")));
  }

  @Test
  void aBulkGivesUpTwoMinutesAfterItsFirstSendUnlessToldOtherwise() {
    assertEquals(120_000, new BulkRetryPolicy(3, 1_000, 10_000).maxLifetimeMillis());
    assertEquals(500, new BulkRetryPolicy(3, 1_000, 10_000, 500).maxLifetimeMillis());
    assertEquals(0, new BulkRetryPolicy(3, 1_000, 10_000, -5).maxLifetimeMillis());
  }

  @Test
  void nonsensicalSettingsAreNormalisedInsteadOfBreakingTheSink() {
    BulkRetryPolicy negative = new BulkRetryPolicy(-1, -5, -10);
    assertEquals(new BulkRetryPolicy(0, 0, 0), negative);

    BulkRetryPolicy capBelowInitial = new BulkRetryPolicy(3, 1_000, 10);
    assertEquals(1_000, capBelowInitial.maxBackoffMillis());
    assertEquals(1_000, capBelowInitial.backoffMillis(3));
  }
}
