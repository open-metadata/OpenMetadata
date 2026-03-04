package org.openmetadata.service.util.jdbi;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.openmetadata.service.monitoring.RequestLatencyContext;

@Slf4j
public class OMSqlLogger implements SqlLogger {
  private static final String DB_TIMER_CONTEXT_KEY = "db.timer.context";
  private static final Pattern SQL_TYPE_PATTERN =
      Pattern.compile(
          "^\\s*(SELECT|INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP)\\b",
          Pattern.CASE_INSENSITIVE);

  private static volatile long slowQueryThresholdMs = 100;

  private static final ConcurrentHashMap<String, Timer> LATENCY_TIMERS = new ConcurrentHashMap<>();
  private static final ConcurrentHashMap<String, Counter> QUERY_COUNTERS =
      new ConcurrentHashMap<>();
  private static final ConcurrentHashMap<String, Counter> SLOW_QUERY_COUNTERS =
      new ConcurrentHashMap<>();
  private static final ConcurrentHashMap<String, DistributionSummary> SLOW_QUERY_SUMMARIES =
      new ConcurrentHashMap<>();

  private static final Timer LEGACY_JDBI_TIMER = Metrics.timer("jdbi_requests_seconds");
  private static final Timer LEGACY_LATENCY_TIMER = Metrics.timer("jdbi_latency_requests_seconds");

  public static void setSlowQueryThresholdMs(long thresholdMs) {
    slowQueryThresholdMs = thresholdMs;
    LOG.info("Slow query threshold set to {} ms", thresholdMs);
  }

  public static long getSlowQueryThresholdMs() {
    return slowQueryThresholdMs;
  }

  @Override
  public void logBeforeExecution(StatementContext context) {
    if (LOG.isDebugEnabled()) {
      LOG.debug("sql {}, parameters {}", context.getRenderedSql(), context.getBinding());
    }

    try {
      Timer.Sample timerSample = RequestLatencyContext.startDatabaseOperation();
      if (timerSample != null) {
        context.define(DB_TIMER_CONTEXT_KEY, timerSample);
      }
    } catch (Exception e) {
      // Ignore - latency tracking is optional
    }
  }

  @Override
  public void logAfterExecution(StatementContext context) {
    long elapsedTimeMillis = context.getElapsedTime(ChronoUnit.MILLIS);
    long elapsedTime = context.getElapsedTime(ChronoUnit.SECONDS);

    String queryType = extractQueryType(context.getRenderedSql());

    // Use simple timer without histogram buckets for high-volume per-query metrics
    // This significantly reduces Prometheus cardinality (histogram creates ~50 series per tag
    // combo)
    // Detailed latency analysis is available via slow query metrics below
    Timer latencyTimer =
        LATENCY_TIMERS.computeIfAbsent(
            queryType,
            type ->
                Timer.builder("db.query.latency")
                    .tag("type", type)
                    .publishPercentileHistogram(false)
                    .register(Metrics.globalRegistry));
    latencyTimer.record(elapsedTimeMillis, TimeUnit.MILLISECONDS);

    Counter queryCounter =
        QUERY_COUNTERS.computeIfAbsent(
            queryType, type -> Metrics.counter("db.query.count", "type", type));
    queryCounter.increment();

    if (elapsedTimeMillis > slowQueryThresholdMs) {
      Counter slowCounter =
          SLOW_QUERY_COUNTERS.computeIfAbsent(
              queryType, type -> Metrics.counter("db.query.slow", "type", type));
      slowCounter.increment();

      DistributionSummary slowSummary =
          SLOW_QUERY_SUMMARIES.computeIfAbsent(
              queryType,
              type ->
                  DistributionSummary.builder("db.query.slow.latency")
                      .tag("type", type)
                      .register(Metrics.globalRegistry));
      slowSummary.record(elapsedTimeMillis);
    }

    LEGACY_JDBI_TIMER.record((long) (elapsedTime * 1000), TimeUnit.MILLISECONDS);
    LEGACY_LATENCY_TIMER.record((long) (elapsedTime * 1000), TimeUnit.MILLISECONDS);

    try {
      Object timerSample = context.getAttribute(DB_TIMER_CONTEXT_KEY);
      if (timerSample instanceof Timer.Sample) {
        RequestLatencyContext.endDatabaseOperation((Timer.Sample) timerSample);
      }
    } catch (Exception e) {
      // Ignore - latency tracking is optional
    }

    if (LOG.isDebugEnabled()) {
      LOG.debug(
          "sql {}, parameters {}, timeTaken {} ms",
          context.getRenderedSql(),
          context.getBinding(),
          elapsedTimeMillis);
    }
  }

  private String extractQueryType(String sql) {
    if (sql == null || sql.isBlank()) {
      return "UNKNOWN";
    }
    var matcher = SQL_TYPE_PATTERN.matcher(sql);
    if (matcher.find()) {
      return matcher.group(1).toUpperCase();
    }
    return "OTHER";
  }
}
