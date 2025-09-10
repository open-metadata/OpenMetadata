package org.openmetadata.service.migration.mysql.v198;

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
      String catalog = connection.getCatalog();

      boolean columnsAdded = addUserActivityColumns(connection, metaData, catalog);
      addUserActivityIndexes(connection, metaData, catalog);

      if (columnsAdded) {
        LOG.info("User activity columns migration completed successfully");
      }
    } catch (Exception e) {
      LOG.error("User activity migration failed", e);
      throw new RuntimeException("Migration failed: " + e.getMessage(), e);
    }
  }

  private boolean addUserActivityColumns(
      Connection connection, DatabaseMetaData metaData, String catalog) throws SQLException {
    boolean lastLoginExists = columnExists(metaData, catalog, "lastLoginTime");
    boolean lastActivityExists = columnExists(metaData, catalog, "lastActivityTime");

    if (!lastLoginExists || !lastActivityExists) {
      LOG.info("User activity columns not present, adding missing columns");
    } else {
      LOG.info("User activity columns already present, skipping column creation");
    }

    if (!lastLoginExists) {
      executeStatement(
          connection,
          "ALTER TABLE user_entity ADD COLUMN lastLoginTime BIGINT UNSIGNED "
              + "GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.lastLoginTime'))) VIRTUAL");
    } else {
      validateColumn(connection, "lastLoginTime");
    }

    if (!lastActivityExists) {
      executeStatement(
          connection,
          "ALTER TABLE user_entity ADD COLUMN lastActivityTime BIGINT UNSIGNED "
              + "GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.lastActivityTime'))) VIRTUAL");
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
          connection, String.format("ALTER TABLE user_entity DROP COLUMN %s", columnName));
      String columnDef =
          String.format(
              "ALTER TABLE user_entity ADD COLUMN %s BIGINT UNSIGNED "
                  + "GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.%s'))) VIRTUAL",
              columnName, columnName);
      executeStatement(connection, columnDef);
    }
  }

  private void addUserActivityIndexes(
      Connection connection, DatabaseMetaData metaData, String catalog) throws SQLException {
    String[][] indexDefs = {
      {"idx_user_entity_last_login_time", "lastLoginTime"},
      {"idx_user_entity_last_activity_time", "lastActivityTime"},
      {"idx_user_entity_last_login_deleted", "lastLoginTime, deleted"},
      {"idx_user_entity_last_activity_deleted", "lastActivityTime, deleted"}
    };

    for (String[] indexDef : indexDefs) {
      if (!indexExists(metaData, catalog, indexDef[0])) {
        try {
          executeStatement(
              connection,
              String.format("CREATE INDEX %s ON user_entity(%s)", indexDef[0], indexDef[1]));
        } catch (SQLException e) {
          LOG.error("Failed to create index {}: {}", indexDef[0], e.getMessage());
        }
      }
    }
  }

  private boolean columnExists(DatabaseMetaData metaData, String catalog, String columnName)
      throws SQLException {
    try (ResultSet rs = metaData.getColumns(catalog, null, USER_ENTITY_TABLE, columnName)) {
      return rs.next();
    }
  }

  private boolean indexExists(DatabaseMetaData metaData, String catalog, String indexName)
      throws SQLException {
    try (ResultSet rs = metaData.getIndexInfo(catalog, null, USER_ENTITY_TABLE, false, false)) {
      while (rs.next()) {
        if (indexName.equalsIgnoreCase(rs.getString("INDEX_NAME"))) {
          return true;
        }
      }
    }
    return false;
  }

  private void executeStatement(Connection connection, String sql) throws SQLException {
    try (Statement stmt = connection.createStatement()) {
      stmt.execute(sql);
    }
  }
}
