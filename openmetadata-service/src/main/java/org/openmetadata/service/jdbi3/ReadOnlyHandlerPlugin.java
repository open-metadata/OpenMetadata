/*
 *  Copyright 2024 Collate
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

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.spi.JdbiPlugin;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.StatementCustomizer;

/**
 * JDBI plugin that handles @ReadOnly annotations to enable AWS JDBC driver read replica routing.
 *
 * <p>This plugin only activates when using the AWS JDBC driver (software.amazon.jdbc.Driver).
 * For other drivers, it performs no operations to avoid unnecessary overhead.
 *
 * <p>When active, the plugin adds a statement customizer that detects @ReadOnly methods in the call stack
 * and sets the database connection to read-only mode by calling connection.setReadOnly(true).
 * This enables the AWS JDBC driver's readWriteSplitting plugin to route SELECT queries to Aurora read replicas.
 *
 * <p>The plugin works by examining the call stack before SQL execution and conditionally setting
 * the connection to read-only mode if a @ReadOnly annotated method is detected AND the connection
 * is not currently in an active transaction.
 *
 * <p>Transaction-aware safety features:
 * <ul>
 *   <li>Only activates for AWS JDBC driver to avoid unnecessary processing</li>
 *   <li>Skips read-only setting when connection is in active transaction</li>
 *   <li>Logs warnings when @ReadOnly is used within @Transaction contexts</li>
 *   <li>Provides metrics for monitoring problematic usage patterns</li>
 *   <li>Graceful exception handling prevents failures</li>
 * </ul>
 */
@Slf4j
public class ReadOnlyHandlerPlugin implements JdbiPlugin {

  private static final String AWS_JDBC_DRIVER = "software.amazon.jdbc.Driver";
  private final boolean isAwsDriver;

  // Metrics for monitoring
  private static final AtomicLong readOnlyInTransactionCount = new AtomicLong(0);
  private static final AtomicLong readOnlyEnabledCount = new AtomicLong(0);

  public ReadOnlyHandlerPlugin(String driverClass) {
    this.isAwsDriver = AWS_JDBC_DRIVER.equals(driverClass);
    LOG.debug(
        "ReadOnlyHandlerPlugin initialized with driver: {}, AWS driver: {}",
        driverClass,
        isAwsDriver);
  }

  @Override
  public void customizeJdbi(Jdbi jdbi) {
    if (!isAwsDriver) {
      return;
    }

    LOG.debug("Adding ReadOnly statement customizer for AWS JDBC driver");
    jdbi.addCustomizer(
        new StatementCustomizer() {
          @Override
          public void beforeExecution(PreparedStatement stmt, StatementContext ctx) {
            if (isReadOnlyContext()) {
              try {
                Connection connection = ctx.getConnection();

                // Check if we're in an active transaction
                boolean inTransaction = !connection.getAutoCommit();

                if (inTransaction) {
                  // We're in a transaction - DO NOT set read-only
                  readOnlyInTransactionCount.incrementAndGet();

                  LOG.debug("Skipping read-only flag for query within transaction");

                  // Log warning periodically to avoid log spam
                  if (readOnlyInTransactionCount.get() % 100 == 1) {
                    LOG.warn(
                        "Detected {} @ReadOnly methods called within @Transaction contexts. "
                            + "This prevents read replica routing. Consider refactoring to separate "
                            + "read operations from transactions for better performance.",
                        readOnlyInTransactionCount.get());
                  }
                } else {
                  // Not in a transaction - safe to enable read-only
                  boolean originalReadOnly = connection.isReadOnly();
                  if (!originalReadOnly) {
                    connection.setReadOnly(true);
                    readOnlyEnabledCount.incrementAndGet();
                    LOG.debug("Set connection to read-only for SQL execution in @ReadOnly context");

                    // Note: Connection will be returned to pool and reset by HikariCP
                    // AWS JDBC driver will use read-only hint for routing during execution
                  }
                }
              } catch (SQLException e) {
                LOG.warn(
                    "Unable to set connection to read-only: {}. Operation will continue.",
                    e.getMessage());
              }
            }
          }
        });
  }

  /**
   * Check if there's a @ReadOnly annotated method in the current call stack.
   * This examines the stack trace to find DAO method calls with @ReadOnly annotation.
   */
  private boolean isReadOnlyContext() {
    StackTraceElement[] stack = Thread.currentThread().getStackTrace();

    for (StackTraceElement element : stack) {
      try {
        String className = element.getClassName();
        String methodName = element.getMethodName();

        // Focus on our DAO interfaces
        if (!className.contains("org.openmetadata.service.jdbi3")
            || className.contains("ReadOnlyHandlerPlugin")) {
          continue;
        }

        Class<?> clazz = Class.forName(className);
        // Check if this is an interface (DAO) with the method
        if (clazz.isInterface()) {
          for (java.lang.reflect.Method method : clazz.getMethods()) {
            if (method.getName().equals(methodName) && method.isAnnotationPresent(ReadOnly.class)) {
              LOG.debug("Found @ReadOnly method in call stack: {}.{}", className, methodName);
              return true;
            }
          }
        }
      } catch (ClassNotFoundException | SecurityException e) {
        // Ignore and continue
        LOG.trace("Unable to check method for @ReadOnly annotation: {}", e.getMessage());
      }
    }
    return false;
  }

  /**
   * Get metrics for monitoring read-only usage patterns.
   * Useful for identifying code that needs refactoring.
   */
  public static ReadOnlyMetrics getMetrics() {
    return new ReadOnlyMetrics(readOnlyInTransactionCount.get(), readOnlyEnabledCount.get());
  }

  /**
   * Reset metrics (useful for testing)
   */
  public static void resetMetrics() {
    readOnlyInTransactionCount.set(0);
    readOnlyEnabledCount.set(0);
  }

  /**
   * Metrics holder class for read-only usage monitoring
   */
  public static class ReadOnlyMetrics {
    public final long readOnlyInTransactionCount;
    public final long readOnlyEnabledCount;

    public ReadOnlyMetrics(long readOnlyInTransactionCount, long readOnlyEnabledCount) {
      this.readOnlyInTransactionCount = readOnlyInTransactionCount;
      this.readOnlyEnabledCount = readOnlyEnabledCount;
    }

    @Override
    public String toString() {
      return String.format(
          "ReadOnlyMetrics{readOnlyEnabled=%d, readOnlyInTransaction=%d}",
          readOnlyEnabledCount, readOnlyInTransactionCount);
    }
  }
}
