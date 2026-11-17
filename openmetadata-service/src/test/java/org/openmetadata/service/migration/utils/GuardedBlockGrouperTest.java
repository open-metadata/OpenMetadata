package org.openmetadata.service.migration.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.util.EntityUtil;

class GuardedBlockGrouperTest {
  private static final String SOURCE = "2.1.0/mysql/schemaChanges.sql";
  private static final String SET_DDL =
      "-- add the column\nSET @c_ddl = (SELECT IF(1 = 0, 'SELECT 1', 'ALTER TABLE t ADD COLUMN c INT'))";

  @Test
  void groupsAGuardedBlockIntoOneUnit() {
    List<SqlUnit> units =
        GuardedBlockGrouper.group(
            List.of(
                SET_DDL,
                "PREPARE c_stmt FROM @c_ddl",
                "EXECUTE c_stmt",
                "DEALLOCATE PREPARE c_stmt",
                "UPDATE t SET c = 1"),
            SOURCE);

    assertEquals(2, units.size());
    assertEquals(4, units.get(0).statements().size());
    assertTrue(units.get(0).isBlock());
    assertEquals(List.of("UPDATE t SET c = 1"), units.get(1).statements());
  }

  @Test
  void keepsEverySetBeforeThePrepareInTheBlock() {
    List<SqlUnit> units =
        GuardedBlockGrouper.group(
            List.of(
                "SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns)",
                "SET @stmt := IF(@col_exists = 0, 'ALTER TABLE t ADD COLUMN s INT', 'SELECT 1')",
                "PREPARE add_status FROM @stmt",
                "EXECUTE add_status",
                "DEALLOCATE PREPARE add_status"),
            SOURCE);

    assertEquals(1, units.size());
    assertEquals(5, units.get(0).statements().size());
  }

  @Test
  void acceptsASplitPrepareCommentsAndNoDeallocate() {
    List<SqlUnit> units =
        GuardedBlockGrouper.group(
            List.of(
                SET_DDL,
                "-- run it\nprepare c_stmt\n  FROM @c_ddl",
                "Execute C_STMT",
                "CREATE TABLE IF NOT EXISTS u (id INT)"),
            SOURCE);

    assertEquals(2, units.size());
    assertEquals(3, units.get(0).statements().size());
    assertFalse(units.get(1).isBlock());
  }

  @Test
  void blocksThatReuseAStatementNameStayDistinctUnits() {
    List<SqlUnit> units =
        GuardedBlockGrouper.group(
            List.of(
                "SET @ddl = 'ALTER TABLE t ADD COLUMN a INT'",
                "PREPARE stmt FROM @ddl",
                "EXECUTE stmt",
                "DEALLOCATE PREPARE stmt",
                "SET @ddl = 'ALTER TABLE t ADD COLUMN b INT'",
                "PREPARE stmt FROM @ddl",
                "EXECUTE stmt",
                "DEALLOCATE PREPARE stmt"),
            SOURCE);

    assertEquals(2, units.size());
    assertNotEquals(units.get(0).checksum(), units.get(1).checksum());
  }

  @Test
  void aSingleStatementKeepsTheChecksumOfItsText() {
    String statement = "ALTER TABLE t ADD COLUMN c INT";

    SqlUnit unit = GuardedBlockGrouper.group(List.of(statement), SOURCE).get(0);

    assertEquals(EntityUtil.hash(statement), unit.checksum());
  }

  @Test
  void rejectsAPrepareNotFollowedByItsExecute() {
    assertMalformed(List.of(SET_DDL, "PREPARE c_stmt FROM @c_ddl", "UPDATE t SET c = 1"));
    assertMalformed(List.of(SET_DDL, "PREPARE c_stmt FROM @c_ddl", "EXECUTE other_stmt"));
    assertMalformed(List.of(SET_DDL, "PREPARE c_stmt FROM @c_ddl"));
  }

  @Test
  void rejectsAnExecuteOrDeallocateWithoutAPrepare() {
    assertMalformed(List.of("EXECUTE c_stmt"));
    assertMalformed(List.of("DEALLOCATE PREPARE c_stmt"));
  }

  @Test
  void rejectsAVariableThatIsNotReadByAPrepare() {
    assertMalformed(List.of(SET_DDL, "UPDATE t SET c = @c_ddl"));
    assertMalformed(List.of(SET_DDL));
    assertMalformed(List.of(SET_DDL, "PREPARE c_stmt FROM @other_ddl", "EXECUTE c_stmt"));
  }

  private static void assertMalformed(List<String> statements) {
    IllegalStateException error =
        assertThrows(
            IllegalStateException.class, () -> GuardedBlockGrouper.group(statements, SOURCE));
    assertTrue(error.getMessage().contains(SOURCE), error.getMessage());
  }
}
