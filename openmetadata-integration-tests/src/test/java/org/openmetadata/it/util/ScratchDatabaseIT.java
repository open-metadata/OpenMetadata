package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Execution(ExecutionMode.CONCURRENT)
class ScratchDatabaseIT {

  @Test
  void eachBodyGetsAnEmptyWritableDatabaseThatIsDroppedAfterwards() {
    AtomicReference<String> name = new AtomicReference<>();

    ScratchDatabase.withDatabase(
        handle -> {
          name.set(handle.createQuery(currentDatabaseSql()).mapTo(String.class).one());
          assertEquals(0, tableCount(handle));
          handle.execute("CREATE TABLE probe (id INT PRIMARY KEY)");
          handle.execute("INSERT INTO probe VALUES (7)");
          assertEquals(
              List.of(7), handle.createQuery("SELECT id FROM probe").mapTo(Integer.class).list());
        });

    assertEquals(List.of(), databasesNamed(name.get()));
  }

  private static String currentDatabaseSql() {
    return ScratchDatabase.dialect() == ConnectionType.MYSQL
        ? "SELECT DATABASE()"
        : "SELECT current_database()";
  }

  private static int tableCount(Handle handle) {
    String schema =
        ScratchDatabase.dialect() == ConnectionType.MYSQL ? "DATABASE()" : "current_schema()";
    return handle
        .createQuery(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = " + schema)
        .mapTo(Integer.class)
        .one();
  }

  private static List<String> databasesNamed(String name) {
    String sql =
        ScratchDatabase.dialect() == ConnectionType.MYSQL
            ? "SELECT schema_name FROM information_schema.schemata WHERE schema_name = :name"
            : "SELECT datname FROM pg_database WHERE datname = :name";
    return TestSuiteBootstrap.getJdbi()
        .withHandle(h -> h.createQuery(sql).bind("name", name).mapTo(String.class).list());
  }
}
