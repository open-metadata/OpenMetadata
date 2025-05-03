package org.openmetadata.service.util;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;

@Slf4j
public class DebugSqlLogger implements SqlLogger {
  @Override
  public void logBeforeExecution(StatementContext context) {
    LOG.debug("Executing SQL: {}", context.getRenderedSql());
    LOG.debug("Binding Parameters: {}", context.getBinding());
  }
}
