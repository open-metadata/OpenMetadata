package org.openmetadata.service.migration.utils.v1130;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class QuartzTablePurgeTest {

  @Test
  void retriesOnlyDeadlocksAndSerializationFailures() {
    assertTrue(QuartzTablePurge.isDeadlock(wrapped("40P01")), "Postgres deadlock");
    assertTrue(QuartzTablePurge.isDeadlock(wrapped("40001")), "MySQL deadlock");
    assertFalse(QuartzTablePurge.isDeadlock(wrapped("23503")), "foreign-key violation");
    assertFalse(QuartzTablePurge.isDeadlock(new IllegalStateException("no SQL cause")));
  }

  @Test
  void postgresLocksQuartzLocksFirstAndEveryPurgedTable() {
    String statement = QuartzTablePurge.lockStatement(ConnectionType.POSTGRES);
    assertTrue(statement.startsWith("LOCK TABLE QRTZ_LOCKS, "), statement);
    assertTrue(statement.endsWith(" IN ACCESS EXCLUSIVE MODE"), statement);
    QuartzTablePurge.TABLES.forEach(table -> assertTrue(statement.contains(table), table));
  }

  @Test
  void mysqlWriteLocksEveryPurgedTable() {
    String statement = QuartzTablePurge.lockStatement(ConnectionType.MYSQL);
    QuartzTablePurge.TABLES.forEach(
        table -> assertTrue(statement.contains("%s WRITE".formatted(table)), table));
  }

  private static RuntimeException wrapped(String sqlState) {
    return new IllegalStateException(new SQLException("driver error", sqlState));
  }
}
