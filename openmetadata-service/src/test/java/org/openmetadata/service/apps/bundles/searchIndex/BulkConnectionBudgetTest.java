package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.SocketTimeoutException;
import java.util.concurrent.CompletionException;
import java.util.concurrent.TimeUnit;
import org.apache.hc.core5.util.Deadline;
import org.apache.hc.core5.util.DeadlineTimeoutException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;

class BulkConnectionBudgetTest {

  @Test
  void singleHostDefaultsLeaveTwoOfTenConnectionsForSearches() {
    BulkConnectionBudget budget = BulkConnectionBudget.forHttpClientPool(pool("search", 10, 30));

    assertEquals(10, budget.poolCapacity());
    assertEquals(8, budget.permits());
  }

  @Test
  void bulksAreBudgetedForOneHostSoADeadHostCannotOverbookTheOthers() {
    BulkConnectionBudget threeHosts = BulkConnectionBudget.forHttpClientPool(pool("a,b,c", 10, 30));
    assertEquals(10, threeHosts.poolCapacity());
    assertEquals(8, threeHosts.permits());

    BulkConnectionBudget mainDefaults =
        BulkConnectionBudget.forHttpClientPool(pool("a,b", 50, 100));
    assertEquals(50, mainDefaults.poolCapacity());
    assertEquals(40, mainDefaults.permits());
  }

  @Test
  void aTotalBelowTheRouteLimitCapsTheBudget() {
    assertEquals(30, BulkConnectionBudget.forHttpClientPool(pool("search", 50, 30)).poolCapacity());
  }

  @Test
  void unsetLimitsUseTheHttpClientDefaultsTheTransportWouldUse() {
    BulkConnectionBudget budget = BulkConnectionBudget.forHttpClientPool(pool("search", 0, null));

    assertEquals(5, budget.poolCapacity());
    assertEquals(3, budget.permits());
  }

  @Test
  void aTinyPoolStillLetsOneBulkThrough() {
    assertEquals(1, BulkConnectionBudget.forPoolCapacity(1).permits());
    assertEquals(1, BulkConnectionBudget.forPoolCapacity(2).permits());
    assertEquals(1, BulkConnectionBudget.forPoolCapacity(3).permits());
  }

  @Test
  void iamClustersAreBudgetedOnTheAwsSdkPool() {
    BulkConnectionBudget budget = BulkConnectionBudget.forAwsSdkClient();

    assertEquals(50, budget.poolCapacity());
    assertEquals(40, budget.permits());
  }

  @Test
  void onlyLeaseTimeoutsCountAsWaitingForThePool() {
    DeadlineTimeoutException poolWait =
        DeadlineTimeoutException.from(
            Deadline.fromUnixMilliseconds(System.currentTimeMillis() - 100));

    assertTrue(BulkConnectionBudget.isPoolWaitTimeout(poolWait));
    assertTrue(BulkConnectionBudget.isPoolWaitTimeout(new CompletionException(poolWait)));
    assertTrue(
        BulkConnectionBudget.isPoolWaitTimeout(
            new RuntimeException(new CompletionException(poolWait))));
    assertFalse(
        BulkConnectionBudget.isPoolWaitTimeout(new SocketTimeoutException("Read timed out")));
    assertFalse(BulkConnectionBudget.isPoolWaitTimeout(null));
  }

  @Test
  void permitsAreSharedByEveryoneUsingTheBudget() throws InterruptedException {
    BulkConnectionBudget budget = BulkConnectionBudget.forPoolCapacity(3);

    assertTrue(budget.tryAcquire(10, TimeUnit.MILLISECONDS));
    assertFalse(budget.tryAcquire(10, TimeUnit.MILLISECONDS));
    budget.release();
    assertTrue(budget.tryAcquire(10, TimeUnit.MILLISECONDS));
  }

  private static ElasticSearchConfiguration pool(
      String hosts, Integer maxConnPerRoute, Integer maxConnTotal) {
    return new ElasticSearchConfiguration()
        .withHost(hosts)
        .withMaxConnPerRoute(maxConnPerRoute)
        .withMaxConnTotal(maxConnTotal);
  }
}
