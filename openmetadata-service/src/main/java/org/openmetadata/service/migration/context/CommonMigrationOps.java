package org.openmetadata.service.migration.context;

import java.util.List;

public class CommonMigrationOps {
  public static final List<MigrationOps> COMMON_OPS =
      List.of(
          new MigrationOps("tableCount", "SELECT COUNT(1) AS result FROM table_entity"),
          new MigrationOps("databaseServiceCount", "SELECT COUNT(1) AS result FROM dbservice_entity"));

  // Return a copy of the list so that we can store the correct results in each context
  public static List<MigrationOps> getCommonOps() {
    return List.copyOf(COMMON_OPS);
  }
}
