package org.openmetadata.service.migration.utils;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;

@Slf4j
public final class MigrationTableUtil {
  private static final String[] TABLE_TYPES = {"TABLE"};

  private MigrationTableUtil() {}

  /**
   * Whether the table exists in the database and schema the handle is connected to. JDBC metadata
   * asked without a catalog searches every database the account can see, so on a MySQL server that
   * holds several OpenMetadata databases it finds the tables of the others.
   */
  public static boolean tableExists(Handle handle, String tableName) {
    boolean exists = false;
    try {
      Connection connection = handle.getConnection();
      try (ResultSet tables =
          connection
              .getMetaData()
              .getTables(connection.getCatalog(), connection.getSchema(), tableName, TABLE_TYPES)) {
        // The name is a LIKE pattern, where '_' matches any character.
        while (!exists && tables.next()) {
          exists = tableName.equalsIgnoreCase(tables.getString("TABLE_NAME"));
        }
      }
    } catch (SQLException e) {
      LOG.warn("Could not check for table '{}': {}", tableName, e.getMessage());
    }
    return exists;
  }
}
