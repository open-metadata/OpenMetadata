package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.client.EmbeddingClient.EmbeddingResult;
import org.openmetadata.service.search.vector.client.EmbeddingClient.EmbeddingUsage;
import org.openmetadata.service.search.vector.client.EmbeddingUnavailableException;

class EmbeddingClientTest {

  @Test
  void testMockEmbeddingClient() {
    EmbeddingClient client = new MockEmbeddingClient(384);

    float[] embedding = client.embed("test text");
    assertNotNull(embedding);
    assertEquals(384, embedding.length);
    assertEquals(384, client.getDimension());
    assertEquals("mock-model", client.getModelId());
  }

  @Test
  void testBatchEmbeddings() {
    EmbeddingClient client = new MockEmbeddingClient(512);

    List<float[]> embeddings = client.embedBatch(List.of("text1", "text2", "text3"));
    assertNotNull(embeddings);
    assertEquals(3, embeddings.size());
    for (float[] emb : embeddings) {
      assertEquals(512, emb.length);
    }
  }

  @Test
  void testDefaultBatchUsesEmbed() {
    EmbeddingClient client = new MockEmbeddingClient(128);

    List<float[]> embeddings = client.embedBatch(List.of("a", "b"));
    assertEquals(2, embeddings.size());
    assertEquals(128, embeddings.get(0).length);
    assertEquals(128, embeddings.get(1).length);
  }

  @Test
  void testDifferentDimensions() {
    EmbeddingClient client768 = new MockEmbeddingClient(768);
    EmbeddingClient client1536 = new MockEmbeddingClient(1536);

    assertEquals(768, client768.embed("test").length);
    assertEquals(1536, client1536.embed("test").length);
  }

  @Test
  void testCustomConcurrencyLimitEnforced() {
    int concurrencyLimit = 2;
    CountDownLatch gate = new CountDownLatch(1);
    AtomicInteger concurrentCount = new AtomicInteger(0);
    AtomicInteger maxObservedConcurrent = new AtomicInteger(0);

    EmbeddingClient client =
        new EmbeddingClient(concurrencyLimit) {
          @Override
          protected float[] doEmbed(String text) {
            int current = concurrentCount.incrementAndGet();
            maxObservedConcurrent.accumulateAndGet(current, Math::max);
            try {
              gate.await();
              Thread.sleep(50);
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            } finally {
              concurrentCount.decrementAndGet();
            }
            return new float[] {1.0f};
          }

          @Override
          public int getDimension() {
            return 1;
          }

          @Override
          public String getModelId() {
            return "concurrency-test";
          }
        };

    int totalRequests = 20;
    ExecutorService pool = Executors.newFixedThreadPool(totalRequests);
    try {
      List<CompletableFuture<float[]>> futures = new ArrayList<>();
      for (int i = 0; i < totalRequests; i++) {
        futures.add(CompletableFuture.supplyAsync(() -> client.embed("test"), pool));
      }

      gate.countDown();

      for (CompletableFuture<float[]> f : futures) {
        f.join();
      }

      assertTrue(
          maxObservedConcurrent.get() <= concurrencyLimit,
          "Max concurrent ("
              + maxObservedConcurrent.get()
              + ") exceeded limit ("
              + concurrencyLimit
              + ")");
    } finally {
      pool.shutdown();
    }
  }

  @Test
  void testCircuitOpensAfterConsecutiveFailures() {
    AtomicInteger calls = new AtomicInteger(0);
    EmbeddingClient client = failingClient(calls, false);

    for (int i = 0; i < 5; i++) {
      assertThrows(RuntimeException.class, () -> client.embed("text"));
    }

    assertFalse(client.isAvailable());
    assertThrows(EmbeddingUnavailableException.class, () -> client.embed("text"));
    assertEquals(5, calls.get(), "provider must not be called once the circuit is open");
  }

  @Test
  void testPermanentFailureOpensCircuitImmediately() {
    AtomicInteger calls = new AtomicInteger(0);
    EmbeddingClient client = failingClient(calls, true);

    assertThrows(RuntimeException.class, () -> client.embed("text"));

    assertFalse(client.isAvailable());
    assertThrows(EmbeddingUnavailableException.class, () -> client.embed("text"));
    assertEquals(1, calls.get(), "a permanent failure must open the circuit on the first failure");
  }

  @Test
  void testCircuitRecoversWhenProviderReturns() {
    AtomicInteger calls = new AtomicInteger(0);
    EmbeddingClient client =
        new EmbeddingClient() {
          @Override
          protected float[] doEmbed(String text) {
            if (calls.incrementAndGet() <= 5) {
              throw new RuntimeException("boom");
            }
            return new float[] {1.0f};
          }

          @Override
          protected long openCooldownMillis(boolean permanent) {
            return 0L;
          }

          @Override
          public int getDimension() {
            return 1;
          }

          @Override
          public String getModelId() {
            return "recovery-test";
          }
        };

    for (int i = 0; i < 5; i++) {
      assertThrows(RuntimeException.class, () -> client.embed("text"));
    }

    assertNotNull(client.embed("text"));
    assertTrue(client.isAvailable());
  }

  @Test
  void testHalfOpenAllowsOnlyOneConcurrentProbe() throws InterruptedException {
    AtomicInteger providerCalls = new AtomicInteger(0);
    CountDownLatch probeInFlight = new CountDownLatch(1);
    CountDownLatch releaseProbe = new CountDownLatch(1);
    EmbeddingClient client =
        new EmbeddingClient(8) {
          @Override
          protected float[] doEmbed(String text) {
            int n = providerCalls.incrementAndGet();
            if (n == 1) {
              throw new RuntimeException("boom");
            }
            probeInFlight.countDown();
            try {
              releaseProbe.await();
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            }
            return new float[] {1.0f};
          }

          @Override
          protected boolean isPermanentFailure(RuntimeException failure) {
            return true;
          }

          @Override
          protected long openCooldownMillis(boolean permanent) {
            return 0L;
          }

          @Override
          public int getDimension() {
            return 1;
          }

          @Override
          public String getModelId() {
            return "probe-test";
          }
        };

    assertThrows(RuntimeException.class, () -> client.embed("open"));

    ExecutorService pool = Executors.newSingleThreadExecutor();
    try {
      CompletableFuture<float[]> probe =
          CompletableFuture.supplyAsync(() -> client.embed("probe"), pool);
      assertTrue(
          probeInFlight.await(2, TimeUnit.SECONDS), "the single probe should reach provider");

      assertThrows(
          EmbeddingUnavailableException.class,
          () -> client.embed("concurrent"),
          "a second caller must fail fast while the half-open probe is in flight");

      releaseProbe.countDown();
      assertNotNull(probe.join());
    } finally {
      pool.shutdown();
    }

    assertEquals(
        2,
        providerCalls.get(),
        "exactly one recovery probe may reach the provider while half-open");
    assertTrue(client.isAvailable());
  }

  @Test
  void testUsageListenerDistinguishesQueryFromDocument() {
    EmbeddingClient client = new MockEmbeddingClient(8);
    List<Boolean> queryFlags = new ArrayList<>();
    client.setUsageListener((modelId, text, usage, query) -> queryFlags.add(query));

    client.embed("a document");
    client.embedQuery("a question");

    assertEquals(List.of(false, true), queryFlags);
  }

  @Test
  void testUsageListenerReceivesModelAndText() {
    EmbeddingClient client = new MockEmbeddingClient(8);
    AtomicReference<String> seenModel = new AtomicReference<>();
    AtomicReference<String> seenText = new AtomicReference<>();
    client.setUsageListener(
        (modelId, text, usage, query) -> {
          seenModel.set(modelId);
          seenText.set(text);
        });

    client.embed("the exact input");

    assertEquals("mock-model", seenModel.get());
    assertEquals("the exact input", seenText.get());
  }

  @Test
  void testSubclassOverridingOnlyDoEmbedReportsNoUsage() {
    // Backward compatibility: an existing client that never heard of doEmbedWithUsage still works,
    // and reports null usage so consumers know to estimate.
    EmbeddingClient client = new MockEmbeddingClient(8);
    AtomicReference<EmbeddingUsage> seen = new AtomicReference<>(new EmbeddingUsage(-1L));
    client.setUsageListener((modelId, text, usage, query) -> seen.set(usage));

    assertEquals(8, client.embed("text").length);

    assertNull(seen.get(), "a client that reports no usage must surface null, not a fabricated 0");
  }

  @Test
  void testUsageListenerReceivesProviderReportedUsage() {
    EmbeddingClient client =
        new EmbeddingClient() {
          @Override
          protected float[] doEmbed(String text) {
            return new float[] {1.0f};
          }

          @Override
          protected EmbeddingResult doEmbedWithUsage(String text, boolean query) {
            return new EmbeddingResult(new float[] {2.0f}, new EmbeddingUsage(42L));
          }

          @Override
          public int getDimension() {
            return 1;
          }

          @Override
          public String getModelId() {
            return "usage-test";
          }
        };
    AtomicReference<EmbeddingUsage> seen = new AtomicReference<>();
    client.setUsageListener((modelId, text, usage, query) -> seen.set(usage));

    float[] vector = client.embed("text");

    assertNotNull(seen.get());
    assertEquals(42L, seen.get().inputTokens());
    assertEquals(
        2.0f, vector[0], "the usage-aware path must supply the vector, not the legacy doEmbed");
  }

  @Test
  void testUsageListenerNotNotifiedOnFailure() {
    AtomicInteger calls = new AtomicInteger(0);
    EmbeddingClient client = failingClient(calls, false);
    AtomicInteger notifications = new AtomicInteger(0);
    client.setUsageListener((modelId, text, usage, query) -> notifications.incrementAndGet());

    assertThrows(RuntimeException.class, () -> client.embed("text"));

    assertEquals(0, notifications.get(), "a failed call bills nothing");
  }

  @Test
  void testThrowingUsageListenerNeitherFailsEmbedNorOpensCircuit() {
    // A listener is observability. If a metering bug throws on every call it must not take
    // embeddings down with it, and must not be mistaken for a provider failure.
    EmbeddingClient client = new MockEmbeddingClient(8);
    client.setUsageListener(
        (modelId, text, usage, query) -> {
          throw new IllegalStateException("listener is broken");
        });

    for (int i = 0; i < 6; i++) {
      assertEquals(8, client.embed("text").length);
    }

    assertTrue(client.isAvailable(), "listener failures must not count toward the circuit breaker");
  }

  @Test
  void embedQueryStillReachesADoEmbedQueryOverride() {
    // The compatibility guarantee the whole usage hook rests on. Without this, collapsing the
    // dispatch in embedWithLimit onto doEmbed would pass every other test in this file.
    EmbeddingClient client =
        new EmbeddingClient() {
          @Override
          protected float[] doEmbed(String text) {
            return new float[] {1.0f};
          }

          @Override
          protected float[] doEmbedQuery(String text) {
            return new float[] {2.0f};
          }

          @Override
          public int getDimension() {
            return 1;
          }

          @Override
          public String getModelId() {
            return "dispatch-test";
          }
        };

    assertEquals(1.0f, client.embed("a document")[0]);
    assertEquals(
        2.0f, client.embedQuery("a question")[0], "embedQuery must not collapse onto doEmbed");
  }

  @Test
  void listenerSeesTheSubmittedTextNotTheCallersInput() {
    // Cohere on Bedrock truncates at 2048 chars and reports no usage, so it is the one family that
    // must be estimated from text — and the one where the caller's string is the wrong string.
    EmbeddingClient client =
        new EmbeddingClient() {
          @Override
          protected float[] doEmbed(String text) {
            return new float[] {1.0f};
          }

          @Override
          protected EmbeddingResult doEmbedWithUsage(String text, boolean query) {
            return new EmbeddingResult(new float[] {1.0f}, null, text.substring(0, 2048));
          }

          @Override
          public int getDimension() {
            return 1;
          }

          @Override
          public String getModelId() {
            return "truncating-test";
          }
        };
    AtomicReference<String> seen = new AtomicReference<>();
    client.setUsageListener((modelId, text, usage, query) -> seen.set(text));

    client.embed("x".repeat(5000));

    assertEquals(
        2048, seen.get().length(), "estimating from 5000 chars would bill 2952 never sent");
  }

  @Test
  void aBlockingListenerDoesNotHoldTheConcurrencyPermit() throws InterruptedException {
    // The design claim behind notifyUsage living outside invokeProvider. Move it back inside and
    // this deadlocks on a one-permit client.
    CountDownLatch listenerEntered = new CountDownLatch(1);
    CountDownLatch releaseListener = new CountDownLatch(1);
    AtomicInteger listenerCalls = new AtomicInteger(0);
    EmbeddingClient client =
        new EmbeddingClient(1) {
          @Override
          protected float[] doEmbed(String text) {
            return new float[] {1.0f};
          }

          @Override
          public int getDimension() {
            return 1;
          }

          @Override
          public String getModelId() {
            return "permit-test";
          }
        };
    client.setUsageListener(
        (modelId, text, usage, query) -> {
          if (listenerCalls.incrementAndGet() == 1) {
            listenerEntered.countDown();
            try {
              releaseListener.await();
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            }
          }
        });

    ExecutorService pool = Executors.newSingleThreadExecutor();
    try {
      CompletableFuture<float[]> blocked =
          CompletableFuture.supplyAsync(() -> client.embed("first"), pool);
      assertTrue(listenerEntered.await(2, TimeUnit.SECONDS), "the listener should be reached");

      assertNotNull(client.embed("second"), "a blocked listener must not hold the only permit");

      releaseListener.countDown();
      assertNotNull(blocked.join());
    } finally {
      pool.shutdown();
    }
  }

  private static EmbeddingClient failingClient(AtomicInteger calls, boolean permanent) {
    return new EmbeddingClient() {
      @Override
      protected float[] doEmbed(String text) {
        calls.incrementAndGet();
        throw new RuntimeException("boom");
      }

      @Override
      protected boolean isPermanentFailure(RuntimeException failure) {
        return permanent;
      }

      @Override
      public int getDimension() {
        return 1;
      }

      @Override
      public String getModelId() {
        return "failing-test";
      }
    };
  }

  static class MockEmbeddingClient extends EmbeddingClient {
    private final int dimension;

    MockEmbeddingClient(int dimension) {
      this.dimension = dimension;
    }

    @Override
    protected float[] doEmbed(String text) {
      float[] embedding = new float[dimension];
      int hash = text.hashCode();
      for (int i = 0; i < dimension; i++) {
        embedding[i] = (float) Math.sin(hash + i) * 0.1f;
      }
      return embedding;
    }

    @Override
    public int getDimension() {
      return dimension;
    }

    @Override
    public String getModelId() {
      return "mock-model";
    }
  }
}
