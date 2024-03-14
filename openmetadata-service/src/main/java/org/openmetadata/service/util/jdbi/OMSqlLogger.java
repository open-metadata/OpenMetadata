package org.openmetadata.service.util.jdbi;

import java.time.temporal.ChronoUnit;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.openmetadata.service.util.MicrometerBundleSingleton;

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
    MicrometerBundleSingleton.jdbiRequests.observe(elapsedTime);
    MicrometerBundleSingleton.getJdbiLatencyTimer().record(elapsedTime, TimeUnit.SECONDS);
    if (LOG.isDebugEnabled()) {
      LOG.debug(
          "sql {}, parameters {}, timeTaken {} ms",
          context.getRenderedSql(),
          context.getBinding(),
          context.getElapsedTime(ChronoUnit.MILLIS));
    }
  }
}
