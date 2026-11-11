package org.openmetadata.service.alerting.content.preview;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.alerting.content.preview.MockChangeEventRegistry.EntityScenario;

class MockChangeEventRegistryTest {
  private static final int THREADS = 8;
  private static final int RESOURCES = 20_000;

  // One registry serves every preview and test send, so requests reach it at the same time.
  @Test
  void requestsAtTheSameTimeEachGetTheirFixture() throws Exception {
    MockChangeEventRegistry registry = new MockChangeEventRegistry(new EntityFixtureLoader());
    CountDownLatch start = new CountDownLatch(1);
    List<Callable<Integer>> requests = new ArrayList<>();
    for (int thread = 0; thread < THREADS; thread++) {
      int first = thread;
      requests.add(() -> lookUpEvery(registry, start, first));
    }

    ExecutorService pool = Executors.newFixedThreadPool(THREADS);
    try {
      List<Future<Integer>> answers = new ArrayList<>();
      for (Callable<Integer> request : requests) {
        answers.add(pool.submit(request));
      }
      start.countDown();
      for (Future<Integer> answer : answers) {
        assertEquals(RESOURCES / THREADS * 2, answer.get());
      }
    } finally {
      pool.shutdownNow();
    }
  }

  private static int lookUpEvery(MockChangeEventRegistry registry, CountDownLatch start, int first)
      throws InterruptedException {
    start.await();
    int found = 0;
    for (int resource = first; resource < RESOURCES; resource += THREADS) {
      String name = "resource" + resource;
      assertNotNull(registry.builder(name));
      assertNotNull(registry.scenarioApplier(new EntityScenario(name, EventType.ENTITY_UPDATED)));
      found += 2;
    }
    return found;
  }
}
