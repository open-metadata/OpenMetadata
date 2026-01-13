package org.openmetadata.service.monitoring;

import static org.openmetadata.service.monitoring.MetricUtils.normalizeUri;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

/**
 * Thread-local context for tracking request latencies using Micrometer.
 * This provides accurate latency measurements including percentiles.
 */
@Slf4j
public class RequestLatencyContext {
  private static final String ENDPOINT = "endpoint";
  private static final String METHOD = "method";
  private static final ThreadLocal<RequestContext> requestContext = new ThreadLocal<>();

  // Request-level timers
  private static final ConcurrentHashMap<String, Timer> requestTimers = new ConcurrentHashMap<>();

  // Component-level timers
  private static final ConcurrentHashMap<String, Timer> databaseTimers = new ConcurrentHashMap<>();
  private static final ConcurrentHashMap<String, Timer> searchTimers = new ConcurrentHashMap<>();
  private static final ConcurrentHashMap<String, Timer> internalTimers = new ConcurrentHashMap<>();

  // Percentage tracking - using AtomicReference to hold percentage values per endpoint
  private static final ConcurrentHashMap<String, PercentageHolder> percentageHolders =
      new ConcurrentHashMap<>();

  // Dummy timer for measuring elapsed time without recording
  private static final Timer DUMMY_TIMER =
      Timer.builder("dummy.timer").register(Metrics.globalRegistry);

  /**
   * Holder class for percentage values that can be updated atomically
   */
  private static class PercentageHolder {
    final AtomicReference<Double> databasePercent = new AtomicReference<>(0.0);
    final AtomicReference<Double> searchPercent = new AtomicReference<>(0.0);
    final AtomicReference<Double> internalPercent = new AtomicReference<>(0.0);
  }

  /**
   * Start tracking a new request
   */
  public static void startRequest(String endpoint, String method) {
    // Normalize method to uppercase to ensure consistency
    String normalizedMethod = method.toUpperCase();
    RequestContext context = new RequestContext(endpoint, normalizedMethod);
    requestContext.set(context);
    String normalizedEndpoint = normalizeUri(endpoint);
    String timerKey = normalizedEndpoint + "|" + normalizedMethod;
    Timer timer =
        requestTimers.computeIfAbsent(
            timerKey,
            k ->
                Timer.builder("request.latency.total")
                    .tag(ENDPOINT, normalizedEndpoint)
                    .tag(METHOD, normalizedMethod)
                    .description("Total request latency")
                    .publishPercentileHistogram(true)
                    .minimumExpectedValue(Duration.ofMillis(1))
                    .maximumExpectedValue(Duration.ofSeconds(60))
                    .serviceLevelObjectives(
                        Duration.ofMillis(10),
                        Duration.ofMillis(50),
                        Duration.ofMillis(100),
                        Duration.ofMillis(200),
                        Duration.ofMillis(500),
                        Duration.ofSeconds(1),
                        Duration.ofSeconds(2),
                        Duration.ofSeconds(5),
                        Duration.ofSeconds(10))
                    .register(Metrics.globalRegistry));
    LOG.debug(
        "Created/retrieved timer for endpoint: {}, method: {}, timer: {}",
        normalizedEndpoint,
        normalizedMethod,
        timer);
    context.requestTimerSample = Timer.start(Metrics.globalRegistry);
    context.internalTimerStartNanos = System.nanoTime();
  }

  /**
   * Start timing a database operation
   */
  public static Timer.Sample startDatabaseOperation() {
    RequestContext context = requestContext.get();
    if (context == null) {
      return null;
    }

    long internalStart = context.internalTimerStartNanos;
    if (internalStart > 0) {
      context.internalTime.addAndGet(System.nanoTime() - internalStart);
      context.internalTimerStartNanos = 0;
    }

    context.dbOperationCount.incrementAndGet();
    return Timer.start(Metrics.globalRegistry);
  }

  public static void endDatabaseOperation(Timer.Sample timerSample) {
    if (timerSample == null) return;

    RequestContext context = requestContext.get();
    if (context == null) {
      return;
    }

    // Use the shared dummy timer to measure elapsed time without recording
    long duration = timerSample.stop(DUMMY_TIMER);
    context.dbTime.addAndGet(duration);

    context.internalTimerStartNanos = System.nanoTime();
  }

  public static Timer.Sample startSearchOperation() {
    RequestContext context = requestContext.get();
    if (context == null) {
      return null;
    }
    long internalStart = context.internalTimerStartNanos;
    if (internalStart > 0) {
      context.internalTime.addAndGet(System.nanoTime() - internalStart);
      context.internalTimerStartNanos = 0;
    }

    context.searchOperationCount.incrementAndGet();
    return Timer.start(Metrics.globalRegistry);
  }

  public static void endSearchOperation(Timer.Sample timerSample) {
    if (timerSample == null) return;

    RequestContext context = requestContext.get();
    if (context == null) {
      return;
    }

    // Use the shared dummy timer to measure elapsed time without recording
    long duration = timerSample.stop(DUMMY_TIMER);
    context.searchTime.addAndGet(duration);

    // Resume internal timer
    context.internalTimerStartNanos = System.nanoTime();
  }

  public static void endRequest() {
    RequestContext context = requestContext.get();
    if (context == null) return;

    String normalizedEndpoint = normalizeUri(context.endpoint);
    String timerKey = normalizedEndpoint + "|" + context.method;
    try {
      // Stop request timer
      if (context.requestTimerSample != null) {
        Timer requestTimer = requestTimers.get(timerKey);
        if (requestTimer != null) {
          context.totalTime = context.requestTimerSample.stop(requestTimer);
        } else {
          LOG.warn(
              "Request timer not found for endpoint: {}, method: {}, timerKey: {}, available keys: {}",
              normalizedEndpoint,
              context.method,
              timerKey,
              requestTimers.keySet());
        }
      }

      if (context.internalTimerStartNanos > 0) {
        context.internalTime.addAndGet(System.nanoTime() - context.internalTimerStartNanos);
      }

      // Get final values from atomic fields
      long dbTimeNanos = context.dbTime.get();
      long searchTimeNanos = context.searchTime.get();
      long internalTimeNanos = context.internalTime.get();
      int dbOps = context.dbOperationCount.get();
      int searchOps = context.searchOperationCount.get();

      // Record per-request timers (not per-operation)
      // This gives us the total DB time for THIS request
      Timer dbTimer =
          databaseTimers.computeIfAbsent(
              timerKey,
              k ->
                  Timer.builder("request.latency.database")
                      .tag(ENDPOINT, normalizedEndpoint)
                      .tag(METHOD, context.method)
                      .description("Total database latency per request")
                      .publishPercentileHistogram(true)
                      .minimumExpectedValue(Duration.ofMillis(1))
                      .maximumExpectedValue(Duration.ofSeconds(30))
                      .serviceLevelObjectives(
                          Duration.ofMillis(5),
                          Duration.ofMillis(10),
                          Duration.ofMillis(25),
                          Duration.ofMillis(50),
                          Duration.ofMillis(100),
                          Duration.ofMillis(250),
                          Duration.ofMillis(500),
                          Duration.ofSeconds(1),
                          Duration.ofSeconds(2))
                      .register(Metrics.globalRegistry));
      if (dbTimeNanos > 0) {
        dbTimer.record(dbTimeNanos, java.util.concurrent.TimeUnit.NANOSECONDS);
      }

      // Record total search time for THIS request
      Timer searchTimer =
          searchTimers.computeIfAbsent(
              timerKey,
              k ->
                  Timer.builder("request.latency.search")
                      .tag(ENDPOINT, normalizedEndpoint)
                      .tag(METHOD, context.method)
                      .description("Total search latency per request")
                      .publishPercentileHistogram(true)
                      .minimumExpectedValue(Duration.ofMillis(1))
                      .maximumExpectedValue(Duration.ofSeconds(30))
                      .serviceLevelObjectives(
                          Duration.ofMillis(5),
                          Duration.ofMillis(10),
                          Duration.ofMillis(25),
                          Duration.ofMillis(50),
                          Duration.ofMillis(100),
                          Duration.ofMillis(250),
                          Duration.ofMillis(500),
                          Duration.ofSeconds(1),
                          Duration.ofSeconds(2))
                      .register(Metrics.globalRegistry));
      if (searchTimeNanos > 0) {
        searchTimer.record(searchTimeNanos, java.util.concurrent.TimeUnit.NANOSECONDS);
      }

      // Record internal processing time for THIS request
      Timer internalTimer =
          internalTimers.computeIfAbsent(
              timerKey,
              k ->
                  Timer.builder("request.latency.internal")
                      .tag(ENDPOINT, normalizedEndpoint)
                      .tag(METHOD, context.method)
                      .description("Internal processing latency per request")
                      .publishPercentileHistogram(true)
                      .minimumExpectedValue(Duration.ofMillis(1))
                      .maximumExpectedValue(Duration.ofSeconds(10))
                      .serviceLevelObjectives(
                          Duration.ofMillis(1),
                          Duration.ofMillis(5),
                          Duration.ofMillis(10),
                          Duration.ofMillis(25),
                          Duration.ofMillis(50),
                          Duration.ofMillis(100),
                          Duration.ofMillis(250),
                          Duration.ofMillis(500),
                          Duration.ofSeconds(1))
                      .register(Metrics.globalRegistry));
      if (internalTimeNanos > 0) {
        internalTimer.record(internalTimeNanos, java.util.concurrent.TimeUnit.NANOSECONDS);
      }

      // Record operation counts as distribution summaries to get avg/max/percentiles
      if (dbOps > 0) {
        Metrics.summary(
                "request.operations.database", ENDPOINT, normalizedEndpoint, METHOD, context.method)
            .record(dbOps);
      }

      if (searchOps > 0) {
        Metrics.summary(
                "request.operations.search", ENDPOINT, normalizedEndpoint, METHOD, context.method)
            .record(searchOps);
      }

      if (context.totalTime > 0) {
        long totalNanos = context.totalTime;
        double dbPercent = (dbTimeNanos * 100.0) / totalNanos;
        double searchPercent = (searchTimeNanos * 100.0) / totalNanos;
        double internalPercent = (internalTimeNanos * 100.0) / totalNanos;

        // Get or create percentage holder for this endpoint and method
        PercentageHolder holder =
            percentageHolders.computeIfAbsent(
                timerKey,
                k -> {
                  PercentageHolder newHolder = new PercentageHolder();

                  // Register gauges that read from the atomic references
                  Gauge.builder("request.percentage.database", newHolder.databasePercent::get)
                      .tag(ENDPOINT, normalizedEndpoint)
                      .tag(METHOD, context.method)
                      .description("Percentage of request time spent in database operations")
                      .register(Metrics.globalRegistry);

                  Gauge.builder("request.percentage.search", newHolder.searchPercent::get)
                      .tag(ENDPOINT, normalizedEndpoint)
                      .tag(METHOD, context.method)
                      .description("Percentage of request time spent in search operations")
                      .register(Metrics.globalRegistry);

                  Gauge.builder("request.percentage.internal", newHolder.internalPercent::get)
                      .tag(ENDPOINT, normalizedEndpoint)
                      .tag(METHOD, context.method)
                      .description("Percentage of request time spent in internal processing")
                      .register(Metrics.globalRegistry);

                  return newHolder;
                });

        // Update the percentage values
        holder.databasePercent.set(dbPercent);
        holder.searchPercent.set(searchPercent);
        holder.internalPercent.set(internalPercent);
      }

      // Log slow requests (over 1 second)
      if (context.totalTime > 1_000_000_000L) {
        LOG.warn(
            "Slow request detected - endpoint: {}, total: {}ms, db: {}ms ({}%), search: {}ms ({}%), internal: {}ms ({}%), dbOps: {}, searchOps: {}",
            context.endpoint,
            context.totalTime / 1_000_000,
            dbTimeNanos / 1_000_000,
            (dbTimeNanos * 100) / context.totalTime,
            searchTimeNanos / 1_000_000,
            (searchTimeNanos * 100) / context.totalTime,
            internalTimeNanos / 1_000_000,
            (internalTimeNanos * 100) / context.totalTime,
            dbOps,
            searchOps);
      }

    } finally {
      requestContext.remove();
    }
  }

  /**
   * Get the current request context for propagation to child threads. This allows virtual threads
   * or async tasks to share the same timing context as the parent request thread.
   *
   * @return the current RequestContext, or null if not in a request context
   */
  public static RequestContext getContext() {
    return requestContext.get();
  }

  /**
   * Set the request context in the current thread. Used by child threads to inherit the parent's
   * timing context for accurate metrics tracking across thread boundaries.
   *
   * @param context the RequestContext to set (obtained from parent thread via getContext())
   */
  public static void setContext(RequestContext context) {
    if (context != null) {
      requestContext.set(context);
    }
  }

  /**
   * Clear the request context from the current thread. Should be called in finally blocks by child
   * threads that received context via setContext() to prevent memory leaks in pooled threads.
   */
  public static void clearContext() {
    requestContext.remove();
  }

  /**
   * Reset all static state. This is primarily for testing to ensure clean state between tests. This
   * clears all timer maps so that new timers will be created and registered with the current
   * registry.
   */
  public static void reset() {
    requestContext.remove();
    requestTimers.clear();
    databaseTimers.clear();
    searchTimers.clear();
    internalTimers.clear();
    percentageHolders.clear();
  }

  @Getter
  public static class RequestContext {
    final String endpoint;
    final String method;
    volatile Timer.Sample requestTimerSample;
    volatile long internalTimerStartNanos = 0;

    volatile long totalTime = 0;
    final AtomicLong dbTime = new AtomicLong(0);
    final AtomicLong searchTime = new AtomicLong(0);
    final AtomicLong internalTime = new AtomicLong(0);

    final AtomicInteger dbOperationCount = new AtomicInteger(0);
    final AtomicInteger searchOperationCount = new AtomicInteger(0);

    RequestContext(String endpoint, String method) {
      this.endpoint = endpoint;
      this.method = method;
    }
  }
}
