package org.openmetadata.service.util.jdbi;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.openmetadata.service.monitoring.RequestLatencyContext;

@Slf4j
public class OMSqlLogger implements SqlLogger {
  private static final String DB_TIMER_CONTEXT_KEY = "db.timer.context";

  @Override
  public void logBeforeExecution(StatementContext context) {
    if (LOG.isDebugEnabled()) {
      LOG.debug("sql {}, parameters {}", context.getRenderedSql(), context.getBinding());
    }

    // Start database operation timing using Micrometer
    try {
      io.micrometer.core.instrument.Timer.Sample timerSample =
          RequestLatencyContext.startDatabaseOperation();
      if (timerSample != null) {
        context.define(DB_TIMER_CONTEXT_KEY, timerSample);
      }
    } catch (Exception e) {
      // Ignore - latency tracking is optional
    }
  }

  @Override
  public void logAfterExecution(StatementContext context) {
    long elapsedTime = context.getElapsedTime(ChronoUnit.SECONDS);
    // Record using Micrometer API
    Timer jdbiTimer = Metrics.timer("jdbi_requests_seconds");
    jdbiTimer.record((long) (elapsedTime * 1000), TimeUnit.MILLISECONDS);

    Timer latencyTimer = Metrics.timer("jdbi_latency_requests_seconds");
    latencyTimer.record((long) (elapsedTime * 1000), TimeUnit.MILLISECONDS);

    // End database operation timing using Micrometer
    try {
      Object timerSample = context.getAttribute(DB_TIMER_CONTEXT_KEY);
      if (timerSample instanceof io.micrometer.core.instrument.Timer.Sample) {
        RequestLatencyContext.endDatabaseOperation(
            (io.micrometer.core.instrument.Timer.Sample) timerSample);
      }
    } catch (Exception e) {
      // Ignore - latency tracking is optional
    }

    if (LOG.isDebugEnabled()) {
      LOG.debug(
          "sql {}, parameters {}, timeTaken {} ms",
          context.getRenderedSql(),
          context.getBinding(),
          context.getElapsedTime(ChronoUnit.MILLIS));
    }
  }
}
