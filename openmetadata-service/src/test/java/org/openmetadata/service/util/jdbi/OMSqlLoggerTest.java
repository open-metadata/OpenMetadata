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
package org.openmetadata.service.util.jdbi;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.sql.SQLException;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OMSqlLoggerTest {

  private long originalThreshold;

  @BeforeEach
  void setUp() {
    originalThreshold = OMSqlLogger.getSlowQueryThresholdMs();
  }

  @AfterEach
  void tearDown() {
    OMSqlLogger.setSlowQueryThresholdMs(originalThreshold);
  }

  @Test
  void testDefaultSlowQueryThreshold() {
    assertEquals(100, OMSqlLogger.getSlowQueryThresholdMs());
  }

  @Test
  void testSetSlowQueryThreshold() {
    OMSqlLogger.setSlowQueryThresholdMs(500);
    assertEquals(500, OMSqlLogger.getSlowQueryThresholdMs());

    OMSqlLogger.setSlowQueryThresholdMs(50);
    assertEquals(50, OMSqlLogger.getSlowQueryThresholdMs());
  }

  @Test
  void countsEachDeadlockOnceAgainstTheStatementThatLostIt() {
    SimpleMeterRegistry meters = new SimpleMeterRegistry();
    Metrics.addRegistry(meters);
    try {
      StatementContext statement = mock(StatementContext.class);
      when(statement.getRenderedSql()).thenReturn("/* OMSqlLoggerTest.lose */ SELECT 1");
      OMSqlLogger logger = new OMSqlLogger();
      SQLException postgresDeadlock = new SQLException("deadlock detected", "40P01");

      logger.logException(statement, postgresDeadlock);
      logger.logException(
          statement, new SQLException("current transaction is aborted", "25P02", postgresDeadlock));
      logger.logException(
          statement,
          new SQLException(
              "Lock wait timeout exceeded; try restarting transaction", "40001", 1205));

      assertEquals(
          1.0,
          meters
              .get(OMSqlLogger.DEADLOCK_METRIC)
              .tag(OMSqlLogger.STATEMENT_TAG, "OMSqlLoggerTest.lose")
              .counter()
              .count());
    } finally {
      Metrics.removeRegistry(meters);
    }
  }
}
