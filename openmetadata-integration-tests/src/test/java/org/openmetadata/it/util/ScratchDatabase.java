package org.openmetadata.it.util;

import java.util.UUID;
import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.testcontainers.containers.JdbcDatabaseContainer;

/**
 * An empty database on the suite's database server, for SQL and migration tests that need a schema
 * they build themselves instead of the running server's. It uses the lane's dialect, so the MySQL
 * and PostgreSQL lanes each cover theirs, and is dropped when the test body returns.
 */
public final class ScratchDatabase {
  private ScratchDatabase() {}

  public static ConnectionType dialect() {
    return TestSuiteBootstrap.getConnectionType();
  }

  public static void withDatabase(Consumer<Handle> body) {
    withJdbi(jdbi -> jdbi.useHandle(body::accept));
  }

  public static void withJdbi(Consumer<Jdbi> body) {
    JdbcDatabaseContainer<?> server = TestSuiteBootstrap.getDatabaseContainer();
    ConnectionType dialect = dialect();
    String name = "scratch_" + UUID.randomUUID().toString().replace("-", "");
    Jdbi admin = connect(server, dialect, server.getDatabaseName());
    admin.useHandle(handle -> handle.execute("CREATE DATABASE " + name));
    try {
      body.accept(connect(server, dialect, name));
    } finally {
      admin.useHandle(
          handle ->
              handle.execute(
                  "DROP DATABASE "
                      + name
                      + (dialect == ConnectionType.POSTGRES ? " WITH (FORCE)" : "")));
    }
  }

  private static Jdbi connect(
      JdbcDatabaseContainer<?> server, ConnectionType dialect, String database) {
    boolean mysql = dialect == ConnectionType.MYSQL;
    String url =
        "jdbc:%s://%s:%d/%s%s"
            .formatted(
                mysql ? "mysql" : "postgresql",
                server.getHost(),
                server.getMappedPort(mysql ? 3306 : 5432),
                database,
                mysql ? "?allowPublicKeyRetrieval=true&useSSL=false" : "");
    // MySQLContainer gives root the same password as its user; only root may create databases.
    Jdbi jdbi = Jdbi.create(url, mysql ? "root" : server.getUsername(), server.getPassword());
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlStatements.class).setUnusedBindingAllowed(true);
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(dialect.label));
    return jdbi;
  }
}
