package org.openmetadata.service.monitoring;

import static org.openmetadata.service.monitoring.MetricUtils.LATENCY_SLA_BUCKETS;
import static org.openmetadata.service.monitoring.MetricUtils.normalizeUri;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
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
  public static void startRequest(String endpoint) {
    RequestContext context = new RequestContext(endpoint);
    requestContext.set(context);

    requestTimers.computeIfAbsent(
        normalizeUri(endpoint),
        k ->
            Timer.builder("request.latency.total")
                .tag(ENDPOINT, endpoint)
                .description("Total request latency")
                .sla(LATENCY_SLA_BUCKETS)
                .register(Metrics.globalRegistry));
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

    try {
      // Stop request timer
      if (context.requestTimerSample != null) {
        Timer requestTimer = requestTimers.get(normalizeUri(context.endpoint));
        if (requestTimer != null) {
          context.totalTime = context.requestTimerSample.stop(requestTimer);
        }
      }

      if (context.internalTimerStartNanos > 0) {
        context.internalTime += System.nanoTime() - context.internalTimerStartNanos;
      }

      // Record per-request timers (not per-operation)
      // This gives us the total DB time for THIS request
      Timer dbTimer =
          databaseTimers.computeIfAbsent(
              normalizeUri(context.endpoint),
              k ->
                  Timer.builder("request.latency.database")
                      .tag(ENDPOINT, context.endpoint)
                      .description("Total database latency per request")
                      .sla(LATENCY_SLA_BUCKETS)
                      .register(Metrics.globalRegistry));
      dbTimer.record(context.dbTime, java.util.concurrent.TimeUnit.NANOSECONDS);

      // Record total search time for THIS request
      Timer searchTimer =
          searchTimers.computeIfAbsent(
              normalizeUri(context.endpoint),
              k ->
                  Timer.builder("request.latency.search")
                      .tag(ENDPOINT, context.endpoint)
                      .description("Total search latency per request")
                      .sla(LATENCY_SLA_BUCKETS)
                      .register(Metrics.globalRegistry));
      searchTimer.record(context.searchTime, java.util.concurrent.TimeUnit.NANOSECONDS);

      // Record internal processing time for THIS request
      Timer internalTimer =
          internalTimers.computeIfAbsent(
              normalizeUri(context.endpoint),
              k ->
                  Timer.builder("request.latency.internal")
                      .tag(ENDPOINT, context.endpoint)
                      .description("Internal processing latency per request")
                      .sla(LATENCY_SLA_BUCKETS)
                      .register(Metrics.globalRegistry));
      internalTimer.record(context.internalTime, java.util.concurrent.TimeUnit.NANOSECONDS);

      // Record operation counts as distribution summaries to get avg/max/percentiles
      if (context.dbOperationCount > 0) {
        Metrics.summary("request.operations.database", ENDPOINT, context.endpoint)
            .record(context.dbOperationCount);
      }

      if (context.searchOperationCount > 0) {
        Metrics.summary("request.operations.search", ENDPOINT, context.endpoint)
            .record(context.searchOperationCount);
      }

      if (context.totalTime > 0) {
        long totalNanos = context.totalTime;
        double dbPercent = (context.dbTime * 100.0) / totalNanos;
        double searchPercent = (context.searchTime * 100.0) / totalNanos;
        double internalPercent = (context.internalTime * 100.0) / totalNanos;

        // Get or create percentage holder for this endpoint
        PercentageHolder holder =
            percentageHolders.computeIfAbsent(
                normalizeUri(context.endpoint),
                k -> {
                  PercentageHolder newHolder = new PercentageHolder();

                  // Register gauges that read from the atomic references
                  Gauge.builder("request.percentage.database", newHolder.databasePercent::get)
                      .tag(ENDPOINT, context.endpoint)
                      .description("Percentage of request time spent in database operations")
                      .register(Metrics.globalRegistry);

                  Gauge.builder("request.percentage.search", newHolder.searchPercent::get)
                      .tag(ENDPOINT, context.endpoint)
                      .description("Percentage of request time spent in search operations")
                      .register(Metrics.globalRegistry);

                  Gauge.builder("request.percentage.internal", newHolder.internalPercent::get)
                      .tag(ENDPOINT, context.endpoint)
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
    Timer.Sample requestTimerSample;
    long internalTimerStartNanos = 0;

    long totalTime = 0;
    long dbTime = 0;
    long searchTime = 0;
    long internalTime = 0;

    int dbOperationCount = 0;
    int searchOperationCount = 0;

    RequestContext(String endpoint) {
      this.endpoint = endpoint;
    }
  }
}
