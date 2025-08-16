/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import java.sql.PreparedStatement;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.StatementCustomizer;
import org.jdbi.v3.core.statement.TimingCollector;

/**
 * Query performance logger that monitors and logs slow database queries.
 * This helps identify performance bottlenecks in database operations.
 */
@Slf4j
public class QueryPerformanceLogger implements StatementCustomizer, TimingCollector {

  private static final long SLOW_QUERY_THRESHOLD_MS = 100;
  private static final long VERY_SLOW_QUERY_THRESHOLD_MS = 1000;

  @Override
  public void beforeExecution(PreparedStatement stmt, StatementContext ctx) {
    ctx.define("queryStartTime", System.currentTimeMillis());
  }

  @Override
  public void afterExecution(PreparedStatement stmt, StatementContext ctx) {
    Long startTime = (Long) ctx.getAttribute("queryStartTime");
    if (startTime != null) {
      long duration = System.currentTimeMillis() - startTime;
      String query = ctx.getRenderedSql();

      if (duration > VERY_SLOW_QUERY_THRESHOLD_MS) {
        LOG.error("VERY SLOW QUERY detected - Duration: {}ms, Query: {}", duration, query);
      } else if (duration > SLOW_QUERY_THRESHOLD_MS) {
        LOG.warn("Slow query detected - Duration: {}ms, Query: {}", duration, query);
      } else if (LOG.isDebugEnabled()) {
        LOG.debug("Query executed - Duration: {}ms, Query: {}", duration, query);
      }

      // Store duration for metrics collection
      ctx.define("queryDuration", duration);
    }
  }

  @Override
  public void collect(long elapsedTime, StatementContext ctx) {
    String query = ctx.getRenderedSql();
    long durationMs = Duration.of(elapsedTime, ChronoUnit.NANOS).toMillis();

    // Extract query type and table from SQL
    String queryType = extractQueryType(query);
    String table = extractTableName(query);

    // Log with structured data for metrics collection
    if (durationMs > VERY_SLOW_QUERY_THRESHOLD_MS) {
      LOG.error(
          "Query Performance - Type: {}, Table: {}, Duration: {}ms, Query: {}",
          queryType,
          table,
          durationMs,
          query);
    } else if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      LOG.warn(
          "Query Performance - Type: {}, Table: {}, Duration: {}ms, Query: {}",
          queryType,
          table,
          durationMs,
          query);
    }
  }

  private String extractQueryType(String query) {
    if (query == null) return "UNKNOWN";

    String upperQuery = query.trim().toUpperCase();
    if (upperQuery.startsWith("SELECT")) return "SELECT";
    if (upperQuery.startsWith("INSERT")) return "INSERT";
    if (upperQuery.startsWith("UPDATE")) return "UPDATE";
    if (upperQuery.startsWith("DELETE")) return "DELETE";
    return "OTHER";
  }

  private String extractTableName(String query) {
    if (query == null) return "UNKNOWN";

    String upperQuery = query.trim().toUpperCase();

    // Try to extract table name from common patterns
    if (upperQuery.contains("FROM ")) {
      int fromIndex = upperQuery.indexOf("FROM ") + 5;
      int endIndex = upperQuery.indexOf(" ", fromIndex);
      if (endIndex == -1) endIndex = upperQuery.length();
      String tableName = query.substring(fromIndex, endIndex).trim();
      // Remove any alias
      int aliasIndex = tableName.indexOf(" ");
      if (aliasIndex > 0) {
        tableName = tableName.substring(0, aliasIndex);
      }
      return tableName;
    }

    if (upperQuery.contains("INTO ")) {
      int intoIndex = upperQuery.indexOf("INTO ") + 5;
      int endIndex = upperQuery.indexOf(" ", intoIndex);
      if (endIndex == -1) endIndex = upperQuery.indexOf("(", intoIndex);
      if (endIndex == -1) endIndex = upperQuery.length();
      return query.substring(intoIndex, endIndex).trim();
    }

    if (upperQuery.contains("UPDATE ")) {
      int updateIndex = upperQuery.indexOf("UPDATE ") + 7;
      int endIndex = upperQuery.indexOf(" ", updateIndex);
      if (endIndex == -1) endIndex = upperQuery.length();
      return query.substring(updateIndex, endIndex).trim();
    }

    return "UNKNOWN";
  }
}
