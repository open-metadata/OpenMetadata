package org.openmetadata.service.entity.policy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;

@Isolated("Resizes the shared field-fetch executor")
class EntityFieldFetchExecutorTest {
  @Test
  void queuedReadsProgressWhenThePoolGrowsAndShrinks() throws Exception {
    final var started = new CountDownLatch(1);
    final var release = new CountDownLatch(1);
    EntityPolicySupport.setFieldFetchPoolSize(1);
    try {
      verifyQueuedReads(started, release);
    } finally {
      release.countDown();
      EntityPolicySupport.resetFieldFetchPoolSize();
    }
  }

  private void verifyQueuedReads(CountDownLatch started, CountDownLatch release) throws Exception {
    final var pool = EntityPolicySupport.FIELD_FETCH_EXECUTOR;
    final var first = pool.submit(() -> blockedRead(started, release));
    assertTrue(started.await(10, TimeUnit.SECONDS));
    final var queued = pool.submit(() -> "queued");
    EntityPolicySupport.setFieldFetchPoolSize(2);
    assertEquals("queued", queued.get(10, TimeUnit.SECONDS));
    EntityPolicySupport.setFieldFetchPoolSize(1);
    release.countDown();
    assertEquals("first", first.get(10, TimeUnit.SECONDS));
    assertEquals("next", pool.submit(() -> "next").get(10, TimeUnit.SECONDS));
  }

  private String blockedRead(CountDownLatch started, CountDownLatch release)
      throws InterruptedException {
    started.countDown();
    assertTrue(release.await(10, TimeUnit.SECONDS));
    return "first";
  }
}
