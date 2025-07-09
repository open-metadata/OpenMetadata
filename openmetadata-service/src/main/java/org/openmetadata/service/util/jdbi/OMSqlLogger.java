package org.openmetadata.service.util.jdbi;

import java.time.temporal.ChronoUnit;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;

@Slf4j
public class OMSqlLogger implements SqlLogger {
  @Override
  public void logBeforeExecution(StatementContext context) {
    if (LOG.isDebugEnabled()) {
      LOG.debug("sql {}, parameters {}", context.getRenderedSql(), context.getBinding());
    }
  }

  @Override
  public void logAfterExecution(StatementContext context) {
    long elapsedTime = context.getElapsedTime(ChronoUnit.SECONDS);
    // Record using Micrometer API
    Timer jdbiTimer = Metrics.timer("jdbi_requests_seconds");
    jdbiTimer.record((long)(elapsedTime * 1000), TimeUnit.MILLISECONDS);
    
    Timer latencyTimer = Metrics.timer("jdbi_latency_requests_seconds");
    latencyTimer.record((long)(elapsedTime * 1000), TimeUnit.MILLISECONDS);
    if (LOG.isDebugEnabled()) {
      LOG.debug(
          "sql {}, parameters {}, timeTaken {} ms",
          context.getRenderedSql(),
          context.getBinding(),
          context.getElapsedTime(ChronoUnit.MILLIS));
    }
  }
}
