package org.openmetadata.service.migration.utils.v199;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class MigrationUtil {
  private static final String USER_ENTITY_TABLE = "user_entity";
  private final Handle handle;
  private final ConnectionType connectionType;

  public MigrationUtil(Handle handle, ConnectionType connectionType) {
    this.handle = handle;
    this.connectionType = connectionType;
  }

  public void addUserActivityColumns() {
    try {
      Connection connection = handle.getConnection();
      DatabaseMetaData metaData = connection.getMetaData();
      String catalog = connection.getCatalog();

      if (connectionType == ConnectionType.MYSQL) {
        addMySQLUserActivityColumns(metaData, catalog);
      } else if (connectionType == ConnectionType.POSTGRES) {
        addPostgresUserActivityColumns(metaData);
      }

      LOG.info("Successfully completed user activity columns migration");
    } catch (Exception ex) {
      LOG.error("Error running user activity columns migration", ex);
      throw new RuntimeException("Migration v199 failed", ex);
    }
  }

  private void addMySQLUserActivityColumns(DatabaseMetaData metaData, String catalog)
      throws SQLException {
    boolean lastLoginExists = columnExists(metaData, catalog, "lastLoginTime");
    boolean lastActivityExists = columnExists(metaData, catalog, "lastActivityTime");

    if (!lastLoginExists || !lastActivityExists) {
      LOG.info("User activity columns not present, adding missing columns");
    } else {
      LOG.info("User activity columns already present, skipping column creation");
      return;
    }

    if (!lastLoginExists) {
      handle.execute(
          "ALTER TABLE user_entity ADD COLUMN lastLoginTime BIGINT UNSIGNED "
              + "GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.lastLoginTime'))) VIRTUAL");
      LOG.info("Added lastLoginTime column to user_entity table");
    }

    if (!lastActivityExists) {
      handle.execute(
          "ALTER TABLE user_entity ADD COLUMN lastActivityTime BIGINT UNSIGNED "
              + "GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.lastActivityTime'))) VIRTUAL");
      LOG.info("Added lastActivityTime column to user_entity table");
    }

    // Add indexes
    String[][] indexDefs = {
      {"idx_user_entity_last_login_time", "lastLoginTime"},
      {"idx_user_entity_last_activity_time", "lastActivityTime"},
      {"idx_user_entity_last_login_deleted", "lastLoginTime, deleted"},
      {"idx_user_entity_last_activity_deleted", "lastActivityTime, deleted"}
    };

    for (String[] indexDef : indexDefs) {
      if (!indexExists(metaData, catalog, indexDef[0])) {
        try {
          handle.execute(
              String.format("CREATE INDEX %s ON user_entity(%s)", indexDef[0], indexDef[1]));
          LOG.info("Created index {} on user_entity table", indexDef[0]);
        } catch (Exception e) {
          LOG.warn("Failed to create index {}: {}", indexDef[0], e.getMessage());
        }
      }
    }
  }

  private void addPostgresUserActivityColumns(DatabaseMetaData metaData) throws SQLException {
    boolean lastLoginExists = columnExists(metaData, null, "lastlogintime");
    boolean lastActivityExists = columnExists(metaData, null, "lastactivitytime");

    if (!lastLoginExists || !lastActivityExists) {
      LOG.info("User activity columns not present, adding missing columns");
    } else {
      LOG.info("User activity columns already present, skipping column creation");
      return;
    }

    if (!lastLoginExists) {
      handle.execute(
          "ALTER TABLE user_entity ADD COLUMN IF NOT EXISTS lastLoginTime BIGINT "
              + "GENERATED ALWAYS AS ((json->>'lastLoginTime')::bigint) STORED");
      LOG.info("Added lastLoginTime column to user_entity table");
    }

    if (!lastActivityExists) {
      handle.execute(
          "ALTER TABLE user_entity ADD COLUMN IF NOT EXISTS lastActivityTime BIGINT "
              + "GENERATED ALWAYS AS ((json->>'lastActivityTime')::bigint) STORED");
      LOG.info("Added lastActivityTime column to user_entity table");
    }

    // Add indexes - PostgreSQL supports IF NOT EXISTS
    String[][] indexDefs = {
      {"idx_user_entity_last_login_time", "lastLoginTime"},
      {"idx_user_entity_last_activity_time", "lastActivityTime"},
      {"idx_user_entity_last_login_deleted", "lastLoginTime, deleted"},
      {"idx_user_entity_last_activity_deleted", "lastActivityTime, deleted"}
    };

    for (String[] indexDef : indexDefs) {
      try {
        handle.execute(
            String.format(
                "CREATE INDEX IF NOT EXISTS %s ON user_entity(%s)", indexDef[0], indexDef[1]));
        LOG.info("Created or verified index {} on user_entity table", indexDef[0]);
      } catch (Exception e) {
        LOG.warn("Failed to create index {}: {}", indexDef[0], e.getMessage());
      }
    }
  }

  private boolean columnExists(DatabaseMetaData metaData, String catalog, String columnName)
      throws SQLException {
    // PostgreSQL uses lowercase column names in metadata
    if (connectionType == ConnectionType.POSTGRES) {
      columnName = columnName.toLowerCase();
    }
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
}
