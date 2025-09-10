package org.openmetadata.service.migration.postgres.v198;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

@Slf4j
public class Migration extends MigrationProcessImpl {
  private static final String USER_ENTITY_TABLE = "user_entity";

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    try (Connection connection = handle.getConnection()) {
      DatabaseMetaData metaData = connection.getMetaData();

      boolean columnsAdded = addUserActivityColumns(connection, metaData);
      addUserActivityIndexes(connection);

      if (columnsAdded) {
        LOG.info("User activity columns migration completed successfully");
      }
    } catch (Exception e) {
      LOG.error("User activity migration failed", e);
      throw new RuntimeException("Migration failed: " + e.getMessage(), e);
    }
  }

  private boolean addUserActivityColumns(Connection connection, DatabaseMetaData metaData)
      throws SQLException {
    boolean lastLoginExists = columnExists(metaData, "lastlogintime");
    boolean lastActivityExists = columnExists(metaData, "lastactivitytime");

    if (!lastLoginExists || !lastActivityExists) {
      LOG.info("User activity columns not present, adding missing columns");
    } else {
      LOG.info("User activity columns already present, skipping column creation");
    }

    if (!lastLoginExists) {
      executeStatement(
          connection,
          "ALTER TABLE user_entity ADD COLUMN IF NOT EXISTS lastLoginTime BIGINT "
              + "GENERATED ALWAYS AS ((json->>'lastLoginTime')::bigint) STORED");
    } else {
      validateColumn(connection, "lastLoginTime");
    }

    if (!lastActivityExists) {
      executeStatement(
          connection,
          "ALTER TABLE user_entity ADD COLUMN IF NOT EXISTS lastActivityTime BIGINT "
              + "GENERATED ALWAYS AS ((json->>'lastActivityTime')::bigint) STORED");
    } else {
      validateColumn(connection, "lastActivityTime");
    }

    return !lastLoginExists || !lastActivityExists;
  }

  private void validateColumn(Connection connection, String columnName) throws SQLException {
    try {
      executeStatement(connection, String.format("SELECT %s FROM user_entity LIMIT 1", columnName));
    } catch (SQLException e) {
      LOG.warn("Column {} exists but is misconfigured, recreating", columnName);
      executeStatement(
          connection,
          String.format("ALTER TABLE user_entity DROP COLUMN IF EXISTS %s", columnName));
      String columnDef =
          String.format(
              "ALTER TABLE user_entity ADD COLUMN %s BIGINT "
                  + "GENERATED ALWAYS AS ((json->>'%s')::bigint) STORED",
              columnName, columnName);
      executeStatement(connection, columnDef);
    }
  }

  private void addUserActivityIndexes(Connection connection) throws SQLException {
    String[][] indexDefs = {
      {"idx_user_entity_last_login_time", "lastLoginTime"},
      {"idx_user_entity_last_activity_time", "lastActivityTime"},
      {"idx_user_entity_last_login_deleted", "lastLoginTime, deleted"},
      {"idx_user_entity_last_activity_deleted", "lastActivityTime, deleted"}
    };

    for (String[] indexDef : indexDefs) {
      try {
        executeStatement(
            connection,
            String.format(
                "CREATE INDEX IF NOT EXISTS %s ON user_entity(%s)", indexDef[0], indexDef[1]));
      } catch (SQLException e) {
        LOG.error("Failed to create index {}: {}", indexDef[0], e.getMessage());
      }
    }
  }

  private boolean columnExists(DatabaseMetaData metaData, String columnName) throws SQLException {
    try (ResultSet rs = metaData.getColumns(null, null, USER_ENTITY_TABLE, columnName)) {
      return rs.next();
    }
  }

  private void executeStatement(Connection connection, String sql) throws SQLException {
    try (Statement stmt = connection.createStatement()) {
      stmt.execute(sql);
    }
  }
}
