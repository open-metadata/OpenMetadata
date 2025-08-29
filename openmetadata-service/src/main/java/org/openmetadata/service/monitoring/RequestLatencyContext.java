package org.openmetadata.service.monitoring;

import static org.openmetadata.service.monitoring.MetricUtils.normalizeUri;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
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

    if (context.internalTimerStartNanos > 0) {
      context.internalTime += System.nanoTime() - context.internalTimerStartNanos;
      context.internalTimerStartNanos = 0;
    }

    context.dbOperationCount++;
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
    context.dbTime += duration;

    context.internalTimerStartNanos = System.nanoTime();
  }

  public static Timer.Sample startSearchOperation() {
    RequestContext context = requestContext.get();
    if (context == null) {
      return null;
    }
    if (context.internalTimerStartNanos > 0) {
      context.internalTime += System.nanoTime() - context.internalTimerStartNanos;
      context.internalTimerStartNanos = 0;
    }

    context.searchOperationCount++;
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
    context.searchTime += duration;

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
        context.internalTime += System.nanoTime() - context.internalTimerStartNanos;
      }

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
      if (context.dbTime > 0) {
        dbTimer.record(context.dbTime, java.util.concurrent.TimeUnit.NANOSECONDS);
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
      if (context.searchTime > 0) {
        searchTimer.record(context.searchTime, java.util.concurrent.TimeUnit.NANOSECONDS);
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
      if (context.internalTime > 0) {
        internalTimer.record(context.internalTime, java.util.concurrent.TimeUnit.NANOSECONDS);
      }

      // Record operation counts as distribution summaries to get avg/max/percentiles
      if (context.dbOperationCount > 0) {
        Metrics.summary(
                "request.operations.database", ENDPOINT, normalizedEndpoint, METHOD, context.method)
            .record(context.dbOperationCount);
      }

      if (context.searchOperationCount > 0) {
        Metrics.summary(
                "request.operations.search", ENDPOINT, normalizedEndpoint, METHOD, context.method)
            .record(context.searchOperationCount);
      }

      if (context.totalTime > 0) {
        long totalNanos = context.totalTime;
        double dbPercent = (context.dbTime * 100.0) / totalNanos;
        double searchPercent = (context.searchTime * 100.0) / totalNanos;
        double internalPercent = (context.internalTime * 100.0) / totalNanos;

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
            "Slow request detected - endpoint: {}, total: {}ms, db: {}ms ({}%), search: {}ms ({}%), internal: {}ms ({}%)",
            context.endpoint,
            context.totalTime / 1_000_000,
            context.dbTime / 1_000_000,
            (context.dbTime * 100) / context.totalTime,
            context.searchTime / 1_000_000,
            (context.searchTime * 100) / context.totalTime,
            context.internalTime / 1_000_000,
            (context.internalTime * 100) / context.totalTime);
      }

    } finally {
      requestContext.remove();
    }
  }

  @Getter
  private static class RequestContext {
    final String endpoint;
    final String method;
    Timer.Sample requestTimerSample;
    long internalTimerStartNanos = 0;

    long totalTime = 0;
    long dbTime = 0;
    long searchTime = 0;
    long internalTime = 0;

    int dbOperationCount = 0;
    int searchOperationCount = 0;

    RequestContext(String endpoint, String method) {
      this.endpoint = endpoint;
      this.method = method;
    }
  }
}
