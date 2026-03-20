package org.openmetadata.service.search.vector.client;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Semaphore;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;

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

  public final float[] embed(String text) {
    try {
      concurrencyLimiter.acquire();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RuntimeException(
          "Embedding generation was interrupted while waiting for permit", e);
    }
    try {
      return doEmbed(text);
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

  protected static int resolveMaxConcurrent(ElasticSearchConfiguration config) {
    NaturalLanguageSearchConfiguration nlsCfg = config.getNaturalLanguageSearch();
    if (nlsCfg != null) {
      Integer value = nlsCfg.getMaxConcurrentEmbeddingRequests();
      if (value != null && value > 0) {
        return value;
      }
    }
    return DEFAULT_MAX_CONCURRENT_REQUESTS;
  }
}
