package org.openmetadata.service.search.vector.client;

import io.micrometer.core.instrument.Metrics;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMEmbeddingsConfig;

@Slf4j
public abstract class EmbeddingClient {
  static final int DEFAULT_MAX_CONCURRENT_REQUESTS = 10;

  private static final int FAILURE_THRESHOLD = 5;
  private static final long TRANSIENT_COOLDOWN_MILLIS = 60_000L;
  private static final long PERMANENT_COOLDOWN_MILLIS = 300_000L;
  private static final String CIRCUIT_OPENED_METRIC = "search.embedding.circuit_opened";

  private enum CircuitState {
    CLOSED,
    OPEN,
    HALF_OPEN
  }

  private final Semaphore concurrencyLimiter;
  private final Object circuitLock = new Object();
  private CircuitState circuitState = CircuitState.CLOSED;
  private int consecutiveFailures = 0;
  private long openDeadlineNanos = 0L;
  private String openCause = "";

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
   * Whether {@code failure} is a permanent provider error (auth/config, e.g. Bedrock AccessDenied)
   * that will not recover by retrying, so the circuit opens immediately with a longer cooldown.
   * Providers override to classify their own SDK exceptions; the default treats every failure as
   * transient.
   */
  protected boolean isPermanentFailure(RuntimeException failure) {
    return false;
  }

  /** Cooldown a newly opened circuit stays open before allowing a half-open probe. */
  protected long openCooldownMillis(boolean permanent) {
    return permanent ? PERMANENT_COOLDOWN_MILLIS : TRANSIENT_COOLDOWN_MILLIS;
  }

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
    guardCircuit();
    acquirePermit();
    try {
      float[] embedding = embedder.get();
      recordSuccess();
      return embedding;
    } catch (RuntimeException failure) {
      recordFailure(failure);
      throw failure;
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

  /**
   * Whether embeddings can currently be attempted. Returns {@code false} only while the circuit is
   * open and its cooldown has not elapsed, letting callers skip embedding work (chunking, indexing)
   * during a provider outage without incurring a failed provider call.
   */
  public boolean isAvailable() {
    synchronized (circuitLock) {
      return circuitState == CircuitState.CLOSED || cooldownElapsed();
    }
  }

  public abstract int getDimension();

  public abstract String getModelId();

  private void acquirePermit() {
    try {
      concurrencyLimiter.acquire();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RuntimeException(
          "Embedding generation was interrupted while waiting for permit", e);
    }
  }

  private void guardCircuit() {
    synchronized (circuitLock) {
      if (circuitState != CircuitState.CLOSED) {
        rejectOrProbe();
      }
    }
  }

  private void rejectOrProbe() {
    if (!cooldownElapsed()) {
      throw new EmbeddingUnavailableException(
          String.format(
              "Embedding provider %s is unavailable (circuit open): %s", getModelId(), openCause));
    }
    openDeadlineNanos =
        System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(openCooldownMillis(false));
    circuitState = CircuitState.HALF_OPEN;
    LOG.info("Embedding provider {} circuit half-open; probing recovery", getModelId());
  }

  private boolean cooldownElapsed() {
    return System.nanoTime() - openDeadlineNanos >= 0;
  }

  private void recordSuccess() {
    synchronized (circuitLock) {
      consecutiveFailures = 0;
      if (circuitState != CircuitState.CLOSED) {
        circuitState = CircuitState.CLOSED;
        LOG.info("Embedding provider {} recovered; circuit closed", getModelId());
      }
    }
  }

  private void recordFailure(RuntimeException failure) {
    synchronized (circuitLock) {
      consecutiveFailures++;
      boolean permanent = isPermanentFailure(failure);
      if (shouldOpen(permanent)) {
        openCircuit(failure, permanent);
      }
    }
  }

  private boolean shouldOpen(boolean permanent) {
    return permanent
        || circuitState == CircuitState.HALF_OPEN
        || consecutiveFailures >= FAILURE_THRESHOLD;
  }

  private void openCircuit(RuntimeException failure, boolean permanent) {
    long cooldownMillis = openCooldownMillis(permanent);
    openDeadlineNanos = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(cooldownMillis);
    openCause =
        failure.getMessage() != null ? failure.getMessage() : failure.getClass().getSimpleName();
    if (circuitState != CircuitState.OPEN) {
      Metrics.counter(CIRCUIT_OPENED_METRIC, "model", getModelId()).increment();
      LOG.warn(
          "Embedding provider {} circuit opened for {} ms after {} failure(s): {}",
          getModelId(),
          cooldownMillis,
          consecutiveFailures,
          openCause);
    }
    circuitState = CircuitState.OPEN;
  }

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
