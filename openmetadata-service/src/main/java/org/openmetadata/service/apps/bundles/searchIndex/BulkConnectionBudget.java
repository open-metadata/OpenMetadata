package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Objects;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Stream;
import org.apache.hc.client5.http.impl.nio.PoolingAsyncClientConnectionManager;
import org.apache.hc.core5.util.DeadlineTimeoutException;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import software.amazon.awssdk.http.SdkHttpConfigurationOption;

/**
 * Server-wide cap on bulk requests in flight on one search client's connection pool. Every bulk
 * processor built on the client — reindex, live indexing, the retry worker, column indexing — holds
 * one of these permits while its request is outstanding, so bulks cannot outnumber its connections. A
 * request queued there fails after {@code connectionRequestTimeoutSecs} with a {@link
 * DeadlineTimeoutException} even though the cluster is healthy, and those failures used to open the
 * bulk circuit breaker and drop whole batches. Part of the pool is left to searches.
 *
 * <p>ADR:2026-10-27-bulk-requests-never-outnumber-search-connections
 */
public final class BulkConnectionBudget {
  /** The IAM transport builds its CRT client with the SDK defaults, so this is its pool size. */
  static final int AWS_SDK_MAX_CONNECTIONS =
      SdkHttpConfigurationOption.GLOBAL_HTTP_DEFAULTS.get(
          SdkHttpConfigurationOption.MAX_CONNECTIONS);

  static final int MIN_SEARCH_RESERVE = 2;
  static final double SEARCH_RESERVE_SHARE = 0.2;

  private static final int MAX_CAUSE_DEPTH = 16;
  private static final String HOST_SEPARATOR = ",";

  private final int poolCapacity;
  private final int permits;
  private final Semaphore semaphore;
  private final AtomicLong completedAttempts = new AtomicLong();

  private BulkConnectionBudget(int poolCapacity) {
    this.poolCapacity = poolCapacity;
    this.permits = bulkPermits(poolCapacity);
    this.semaphore = new Semaphore(permits, true);
  }

  public static BulkConnectionBudget forHttpClientPool(ElasticSearchConfiguration config) {
    return new BulkConnectionBudget(httpClientPoolCapacity(config));
  }

  public static BulkConnectionBudget forAwsSdkClient() {
    return new BulkConnectionBudget(AWS_SDK_MAX_CONNECTIONS);
  }

  public static BulkConnectionBudget forPoolCapacity(int poolCapacity) {
    return new BulkConnectionBudget(poolCapacity);
  }

  /**
   * True when {@code error} is HC5's lease timeout: the request waited for a pooled connection and
   * never reached the cluster. Only the connection pools throw {@link DeadlineTimeoutException}.
   */
  public static boolean isPoolWaitTimeout(Throwable error) {
    return Stream.iterate(error, Objects::nonNull, Throwable::getCause)
        .limit(MAX_CAUSE_DEPTH)
        .anyMatch(DeadlineTimeoutException.class::isInstance);
  }

  static int httpClientPoolCapacity(ElasticSearchConfiguration config) {
    ElasticSearchConfiguration settings =
        config != null ? config : new ElasticSearchConfiguration();
    int perRoute =
        positiveOr(
            settings.getMaxConnPerRoute(),
            PoolingAsyncClientConnectionManager.DEFAULT_MAX_CONNECTIONS_PER_ROUTE);
    int total =
        positiveOr(
            settings.getMaxConnTotal(),
            PoolingAsyncClientConnectionManager.DEFAULT_MAX_TOTAL_CONNECTIONS);
    return Math.min(total, hostCount(settings) * perRoute);
  }

  static int bulkPermits(int poolCapacity) {
    int searchReserve =
        Math.max(MIN_SEARCH_RESERVE, (int) Math.ceil(poolCapacity * SEARCH_RESERVE_SHARE));
    return Math.max(1, poolCapacity - searchReserve);
  }

  public int permits() {
    return permits;
  }

  public int poolCapacity() {
    return poolCapacity;
  }

  boolean tryAcquire(long timeout, TimeUnit unit) throws InterruptedException {
    return semaphore.tryAcquire(timeout, unit);
  }

  void release() {
    semaphore.release();
  }

  void recordAttemptCompleted() {
    completedAttempts.incrementAndGet();
  }

  long completedAttempts() {
    return completedAttempts.get();
  }

  private static int hostCount(ElasticSearchConfiguration settings) {
    String hosts = settings.getHost();
    return hosts == null || hosts.isBlank() ? 1 : hosts.split(HOST_SEPARATOR).length;
  }

  private static int positiveOr(Integer value, int fallback) {
    return value != null && value > 0 ? value : fallback;
  }
}
