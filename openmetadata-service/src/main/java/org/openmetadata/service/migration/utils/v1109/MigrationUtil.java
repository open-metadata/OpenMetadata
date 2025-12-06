package org.openmetadata.service.migration.utils.v1109;

import java.io.File;
import java.nio.file.Paths;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.json.JSONObject;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class MigrationUtil {

  public static void handleMissing1102Migration(
      MigrationDAO migrationDAO, ConnectionType connectionType, String nativePath) {
    try {
      LOG.info("Checking if 1.10.2 migration needs to be executed");

      List<String> executedMigrations = migrationDAO.getMigrationVersions();

      if (executedMigrations.contains("1.10.2")) {
        LOG.info("Migration 1.10.2 already executed, skipping fallback");
        return;
      }

      LOG.info(
          "Migration 1.10.2 was not executed (user upgraded through 1.10.3-1.10.7). Running fallback logic.");

      // Execute the 1.10.2 migration logic
      org.openmetadata.service.migration.utils.v1102.MigrationUtil
          .updateSearchSettingsNlqConfiguration();

      // Mark 1.10.2 as executed in SERVER_CHANGE_LOG using same format as getMigrationsPath()
      String dbType = connectionType == ConnectionType.MYSQL ? "mysql" : "postgres";
      File v1102Dir = new File(nativePath, "1.10.2");
      String migrationFileName = Paths.get(v1102Dir.getAbsolutePath(), dbType).toString();

      // Create metrics matching the expected format
      JSONObject metrics = getMetrics();

      migrationDAO.upsertServerMigration(
          "1.10.2", migrationFileName, java.util.UUID.randomUUID().toString(), metrics.toString());

      LOG.info("Successfully executed and marked 1.10.2 migration as completed");

    } catch (Exception e) {
      LOG.error("Error handling missing 1.10.2 migration", e);
      throw new RuntimeException("Failed to handle missing 1.10.2 migration", e);
    }
  }

  private static @NotNull JSONObject getMetrics() {
    JSONObject metrics = new JSONObject();
    metrics.put("botCount", 0);
    metrics.put("teamCount", 0);
    metrics.put("userCount", 0);
    metrics.put("tableCount", 0);
    metrics.put("topicCount", 0);
    metrics.put("mlModelCount", 0);
    metrics.put("glossaryCount", 0);
    metrics.put("pipelineCount", 0);
    metrics.put("dashboardCount", 0);
    metrics.put("testSuiteCount", 0);
    metrics.put("searchIndexCount", 0);
    metrics.put("glossaryTermCount", 0);
    metrics.put("searchServiceCount", 0);
    metrics.put("mlModelServiceCount", 0);
    metrics.put("storageServiceCount", 0);
    metrics.put("databaseServiceCount", 0);
    metrics.put("pipelineServiceCount", 0);
    metrics.put("securityServiceCount", 0);
    metrics.put("dashboardServiceCount", 0);
    metrics.put("messagingServiceCount", 0);
    metrics.put("storageContainerCount", 0);
    metrics.put("fallbackExecution", true);
    return metrics;
  }
}
