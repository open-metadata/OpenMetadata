package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
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
