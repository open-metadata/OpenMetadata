/*
 *  Copyright 2021 Collate
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.config.BulkOperationConfiguration;

@Slf4j
class BulkOperationSemaphoreTest {

  @BeforeEach
  void setUp() {
    BulkOperationSemaphore.reset();
  }

  @AfterEach
  void tearDown() {
    BulkOperationSemaphore.reset();
  }

  @Test
  void testDefaultInitialization() {
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();
    assertNotNull(semaphore);
    assertEquals(10, semaphore.getMaxPermits()); // Default value
    assertEquals(10, semaphore.availablePermits());
  }

  @Test
  void testExplicitInitialization() {
    BulkOperationSemaphore.initialize(25, 5000);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();
    assertEquals(25, semaphore.getMaxPermits());
    assertEquals(25, semaphore.availablePermits());
  }

  @Test
  void testConfigurationBasedInitialization() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setAutoScale(true);
    config.setBulkConnectionPercentage(20);
    config.setMaxConcurrentDbOperations(50);
    config.setAcquireTimeoutMs(10000);

    // With 100 pool size and 20% for bulk, should get 20 permits
    BulkOperationSemaphore.initialize(config, 100);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    // 100 * 20% = 20 (within max of 50)
    assertEquals(20, semaphore.getMaxPermits());
  }

  @Test
  void testAutoScaleCalculation() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setAutoScale(true);
    config.setBulkConnectionPercentage(30);
    config.setMaxConcurrentDbOperations(100);
    config.setAcquireTimeoutMs(10000);

    // With 50 pool size and 30% for bulk, should get 15 permits
    BulkOperationSemaphore.initialize(config, 50);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    // 50 * 30% = 15
    assertEquals(15, semaphore.getMaxPermits());
  }

  @Test
  void testFixedConfiguration() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setAutoScale(false);
    config.setMaxConcurrentDbOperations(15);

    BulkOperationSemaphore.initialize(config, 100);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    assertEquals(15, semaphore.getMaxPermits());
  }

  @Test
  void testAcquireAndRelease() throws Exception {
    BulkOperationSemaphore.initialize(5, 5000);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    assertEquals(5, semaphore.availablePermits());

    semaphore.acquire();
    assertEquals(4, semaphore.availablePermits());

    semaphore.acquire();
    assertEquals(3, semaphore.availablePermits());

    semaphore.release();
    assertEquals(4, semaphore.availablePermits());

    semaphore.release();
    assertEquals(5, semaphore.availablePermits());
  }

  @Test
  void testConcurrentAccess() throws InterruptedException {
    BulkOperationSemaphore.initialize(5, 30000);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    int numThreads = 20;
    AtomicInteger maxConcurrent = new AtomicInteger(0);
    AtomicInteger currentConcurrent = new AtomicInteger(0);
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch doneLatch = new CountDownLatch(numThreads);

    List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());

    for (int i = 0; i < numThreads; i++) {
      new Thread(
              () -> {
                try {
                  startLatch.await();
                  semaphore.acquire();
                  try {
                    int current = currentConcurrent.incrementAndGet();
                    maxConcurrent.updateAndGet(max -> Math.max(max, current));
                    Thread.sleep(50); // Simulate work
                    currentConcurrent.decrementAndGet();
                  } finally {
                    semaphore.release();
                  }
                } catch (Exception e) {
                  errors.add(e);
                } finally {
                  doneLatch.countDown();
                }
              })
          .start();
    }

    startLatch.countDown();
    doneLatch.await();

    assertTrue(errors.isEmpty(), "Should have no errors: " + errors);
    assertTrue(
        maxConcurrent.get() <= 5,
        "Max concurrent should not exceed 5 permits, got: " + maxConcurrent.get());
    assertEquals(5, semaphore.availablePermits(), "All permits should be released");

    LOG.info("Concurrent test: max concurrent was {}", maxConcurrent.get());
  }

  @Test
  void testTimeout() {
    // Initialize with 1 permit and very short timeout
    BulkOperationSemaphore.initialize(1, 100); // 100ms timeout
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    // Acquire the only permit
    assertDoesNotThrow(() -> semaphore.acquire());

    // Try to acquire another - should timeout
    assertThrows(TimeoutException.class, () -> semaphore.acquire());

    // Release and try again - should succeed
    semaphore.release();
    assertDoesNotThrow(() -> semaphore.acquire());

    // Cleanup
    semaphore.release();
  }

  @Test
  void testExecuteWithPermit() throws Exception {
    BulkOperationSemaphore.initialize(3, 5000);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    AtomicInteger counter = new AtomicInteger(0);

    // Execute runnable
    semaphore.executeWithPermit(() -> counter.incrementAndGet());
    assertEquals(1, counter.get());
    assertEquals(3, semaphore.availablePermits()); // Permit should be released

    // Execute callable
    String result = semaphore.executeWithPermit(() -> "test-result");
    assertEquals("test-result", result);
    assertEquals(3, semaphore.availablePermits());
  }

  @Test
  void testExecuteWithPermitReleasesOnException() {
    BulkOperationSemaphore.initialize(3, 5000);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    // Execute runnable that throws
    assertThrows(
        RuntimeException.class,
        () ->
            semaphore.executeWithPermit(
                () -> {
                  throw new RuntimeException("Test exception");
                }));

    // Permit should still be released
    assertEquals(3, semaphore.availablePermits());
  }

  @Test
  void testSmallPoolSizeCalculation() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setAutoScale(true);
    config.setBulkConnectionPercentage(50);
    config.setMaxConcurrentDbOperations(100);

    // With small pool size of 10 and 50% for bulk
    BulkOperationSemaphore.initialize(config, 10);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    // 10 * 50% = 5
    assertEquals(5, semaphore.getMaxPermits());
  }

  @Test
  void testVerySmallPoolSizeMinimum() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setAutoScale(true);
    config.setBulkConnectionPercentage(5); // Only 5% for bulk

    // With pool size of 10 and only 5% for bulk, calculated would be 0.5 -> 1 (minimum)
    BulkOperationSemaphore.initialize(config, 10);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    // Should be at least 1 (minimum enforced)
    assertEquals(1, semaphore.getMaxPermits());
  }

  @Test
  void testSingletonBehavior() {
    BulkOperationSemaphore.initialize(10, 5000);
    BulkOperationSemaphore instance1 = BulkOperationSemaphore.getInstance();
    BulkOperationSemaphore instance2 = BulkOperationSemaphore.getInstance();

    assertSame(instance1, instance2, "Should return same singleton instance");
  }
}
