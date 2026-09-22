package org.openmetadata.service.search.vector.client;

import io.micrometer.core.instrument.Metrics;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
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

  /**
   * Token usage the provider reported for a single embedding call. An embedding call has no output
   * tokens — it returns a vector, not generated text — so the input count is the whole of it.
   */
  public record EmbeddingUsage(long inputTokens) {}

  /**
   * A vector plus the usage of the call that produced it. {@code usage} is {@code null} when the
   * provider does not report token counts (Google's {@code :embedContent} and Cohere on Bedrock
   * never do), so consumers that need a number must estimate one from the submitted text.
   *
   * <p>{@code submittedText} is what actually went to the provider, which is not always what the
   * caller passed in: providers with a hard input limit truncate first (Cohere on Bedrock at 2048
   * chars, well under a normal chunk). Estimating from the caller's string would then overstate
   * every truncated call — and Cohere is precisely the family that reports no usage, so estimation
   * is the only option there. {@code null} means the input went through unchanged.
   *
   * <p>A carrier only: the generated {@code equals}/{@code hashCode} compare {@code vector} by
   * identity, so do not use this record as a map key or in equality assertions.
   */
  public record EmbeddingResult(float[] vector, EmbeddingUsage usage, String submittedText) {

    /** For providers that submit the caller's input unchanged. */
    public EmbeddingResult(float[] vector, EmbeddingUsage usage) {
      this(vector, usage, null);
    }
  }

  /**
   * Notified after each successful embedding call, so a deployment can meter its own embedding
   * traffic without this class knowing anything about how that metering works.
   *
   * <p>Called off the concurrency permit and after the circuit breaker has settled, and any
   * exception it throws is logged and swallowed — a listener is observability and must never fail
   * an embedding or open the circuit.
   *
   * <p>Runs synchronously on the calling thread, once per embedded chunk on the indexing path, so
   * an implementation must not block. Accumulate and report out of band.
   *
   * @param text what the provider received, after any provider-side truncation — not necessarily
   *     what the caller passed in. Estimating a token count from anything else overstates a
   *     truncated call.
   */
  public interface UsageListener {
    void onUsage(String modelId, String text, EmbeddingUsage usage, boolean query);
  }

  private final Semaphore concurrencyLimiter;
  private volatile UsageListener usageListener;
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

  /**
   * Embed {@code text} and report whatever token usage the provider returned alongside the vector.
   *
   * <p>Defaults to the plain {@link #doEmbed}/{@link #doEmbedQuery} pair with no usage, so a client
   * that overrides only those keeps working unchanged. Providers whose response carries a token
   * count (Bedrock Titan's {@code inputTextTokenCount}, OpenAI's {@code usage.prompt_tokens})
   * override this to surface it instead of discarding it.
   */
  protected EmbeddingResult doEmbedWithUsage(String text, boolean query) {
    float[] vector = query ? doEmbedQuery(text) : doEmbed(text);
    return new EmbeddingResult(vector, null);
  }

  /** Register the listener notified after each successful call. {@code null} disables reporting. */
  public void setUsageListener(UsageListener usageListener) {
    this.usageListener = usageListener;
  }

  public final float[] embed(String text) {
    return embedWithLimit(text, false);
  }

  public final float[] embedQuery(String text) {
    return embedWithLimit(text, true);
  }

  private float[] embedWithLimit(String text, boolean query) {
    guardCircuit();
    EmbeddingResult result = invokeProvider(text, query);
    // Deliberately outside invokeProvider: the permit is released and the circuit has settled by
    // now, so a slow listener cannot starve other callers and a throwing one cannot open the
    // circuit.
    notifyUsage(submittedOr(result, text), result.usage(), query);
    return result.vector();
  }

  private EmbeddingResult invokeProvider(String text, boolean query) {
    boolean permitAcquired = false;
    try {
      acquirePermit();
      permitAcquired = true;
      EmbeddingResult result = doEmbedWithUsage(text, query);
      recordSuccess();
      return result;
    } catch (RuntimeException failure) {
      // Record even a permit-acquisition failure so a promoted HALF_OPEN probe always resolves
      // (success -> closed, failure -> reopened) and never wedges the circuit half-open forever.
      recordFailure(failure);
      throw failure;
    } finally {
      if (permitAcquired) {
        concurrencyLimiter.release();
      }
    }
  }

  /** What the provider received: the truncated form when one was reported, else the input. */
  private static String submittedOr(EmbeddingResult result, String text) {
    return result.submittedText() != null ? result.submittedText() : text;
  }

  private void notifyUsage(String text, EmbeddingUsage usage, boolean query) {
    UsageListener listener = usageListener;
    if (listener != null) {
      try {
        listener.onUsage(getModelId(), text, usage, query);
      } catch (RuntimeException e) {
        LOG.warn(
            "Embedding usage listener failed for model {}: {}", getModelId(), e.getMessage(), e);
      }
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
   * Whether embeddings can currently be attempted. Returns {@code false} while the circuit is
   * cooling down (open) or a single recovery probe is in flight (half-open), letting callers skip
   * embedding work (chunking, indexing) during a provider outage without a failed provider call.
   */
  public boolean isAvailable() {
    synchronized (circuitLock) {
      return circuitState == CircuitState.CLOSED
          || (circuitState == CircuitState.OPEN && cooldownElapsed());
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
    // Reject while a probe is already in flight (HALF_OPEN) or the open cooldown has not elapsed.
    // Gating HALF_OPEN on the state (not a deadline) keeps exactly one probe in flight even if it
    // runs longer than the cooldown; the probe always resolves via recordSuccess/recordFailure.
    if (circuitState == CircuitState.HALF_OPEN || !cooldownElapsed()) {
      throw new EmbeddingUnavailableException(
          String.format(
              "Embedding provider %s is unavailable (circuit open): %s", getModelId(), openCause));
    }
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
