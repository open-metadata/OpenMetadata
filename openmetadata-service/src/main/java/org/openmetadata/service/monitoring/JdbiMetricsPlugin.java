package org.openmetadata.service.monitoring;

import io.micrometer.core.instrument.Timer;
import java.sql.SQLException;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;

/**
 * JDBI SQL Logger that automatically tracks database query metrics using Micrometer.
 * This logger measures query duration and tracks errors for all database operations.
 */
public class JdbiMetricsPlugin {
  
  /**
   * Create a SQL logger that tracks metrics
   */
  public static SqlLogger createMetricsSqlLogger(OpenMetadataMetrics metrics) {
    return new MetricsSqlLogger(metrics);
  }
  
  /**
   * SQL Logger implementation that tracks individual query metrics
   */
  private static class MetricsSqlLogger implements SqlLogger {
    private final OpenMetadataMetrics metrics;
    
    public MetricsSqlLogger(OpenMetadataMetrics metrics) {
      this.metrics = metrics;
    }
    @Override
    public void logBeforeExecution(StatementContext context) {
      // Store timer sample in context for later use
      Timer.Sample sample = metrics.startDatabaseQueryTimer();
      context.define("metricsTimerSample", sample);
    }
    
    @Override
    public void logAfterExecution(StatementContext context) {
      Timer.Sample sample = (Timer.Sample) context.getAttribute("metricsTimerSample");
      if (sample != null) {
        String queryType = extractQueryType(context.getRenderedSql());
        metrics.recordDatabaseQuery(sample, queryType, true);
      }
    }
    
    @Override
    public void logException(StatementContext context, SQLException ex) {
      Timer.Sample sample = (Timer.Sample) context.getAttribute("metricsTimerSample");
      if (sample != null) {
        String queryType = extractQueryType(context.getRenderedSql());
        metrics.recordDatabaseQuery(sample, queryType, false);
        metrics.incrementDatabaseErrors(ex.getSQLState() != null ? ex.getSQLState() : "unknown");
      }
    }
    
    private String extractQueryType(String sql) {
      if (sql == null) return "unknown";
      
      String trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith("SELECT")) return "select";
      if (trimmed.startsWith("INSERT")) return "insert";
      if (trimmed.startsWith("UPDATE")) return "update";
      if (trimmed.startsWith("DELETE")) return "delete";
      if (trimmed.startsWith("CREATE")) return "create";
      if (trimmed.startsWith("DROP")) return "drop";
      if (trimmed.startsWith("ALTER")) return "alter";
      return "other";
    }
  }
}