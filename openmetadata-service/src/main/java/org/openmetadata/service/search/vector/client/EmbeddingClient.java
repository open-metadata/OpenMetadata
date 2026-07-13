package org.openmetadata.service.search.vector.client;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Semaphore;
import java.util.function.Supplier;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMEmbeddingsConfig;

public abstract class EmbeddingClient {
  static final int DEFAULT_MAX_CONCURRENT_REQUESTS = 10;

  private final Semaphore concurrencyLimiter;

  protected EmbeddingClient(int maxConcurrentRequests) {
    if (maxConcurrentRequests < 1) {
      throw new IllegalArgumentException(
          "maxConcurrentRequests must be >= 1, but was " + maxConcurrentRequests);
    }
    this.concurrencyLimiter = new Semaphore(maxConcurrentRequests);
  }

  protected EmbeddingClient() {
    this(DEFAULT_MAX_CONCURRENT_REQUESTS);
  }

  protected abstract float[] doEmbed(String text);

  /**
   * Embed text that will be used as a search query. Defaults to treating a query like a document;
   * clients whose backend distinguishes query and document embeddings (e.g. Cohere on Bedrock)
   * override this.
   */
  protected float[] doEmbedQuery(String text) {
    return doEmbed(text);
  }

  public final float[] embed(String text) {
    return embedWithLimit(() -> doEmbed(text));
  }

  public final float[] embedQuery(String text) {
    return embedWithLimit(() -> doEmbedQuery(text));
  }

  private float[] embedWithLimit(Supplier<float[]> embedder) {
    try {
      concurrencyLimiter.acquire();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RuntimeException(
          "Embedding generation was interrupted while waiting for permit", e);
    }
    try {
      return embedder.get();
    } finally {
      concurrencyLimiter.release();
    }
  }

  public List<float[]> embedBatch(List<String> texts) {
    List<float[]> results = new ArrayList<>();
    for (String text : texts) {
      results.add(embed(text));
    }
    return results;
  }

  public abstract int getDimension();

  public abstract String getModelId();

  protected static int resolveMaxConcurrent(LLMConfiguration config) {
    int result = DEFAULT_MAX_CONCURRENT_REQUESTS;
    LLMEmbeddingsConfig embeddings = config != null ? config.getEmbeddings() : null;
    if (embeddings != null) {
      Integer value = embeddings.getMaxConcurrentRequests();
      if (value != null && value > 0) {
        result = value;
      }
    }
    return result;
  }
}
