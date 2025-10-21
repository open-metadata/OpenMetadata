package org.openmetadata.service.migration.utils.v1110;

import static org.openmetadata.service.util.EntityUtil.hash;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.utils.MigrationFile;

@Slf4j
public class MigrationUtil {
  private static final Map<String, String> PATH_BY_TAG =
      Map.of(
          "PII.Sensitive", "data/tags/Sensitive.json",
          "PII.NonSensitive", "data/tags/NonSensitive.json");
  private final MigrationFile migrationFile;

  public MigrationUtil(MigrationFile migrationFile) {
    this.migrationFile = migrationFile;
  }

  public Map<String, QueryStatus> setRecognizersForSensitiveTags(
      String queryTemplate, Handle handle, MigrationDAO migrationDAO, boolean isForceMigration) {
    Map<String, QueryStatus> result = new HashMap<>();
    PATH_BY_TAG.forEach(
        (tagFqn, relativePath) -> {
          try {
            updateTagRecognizers(
                handle,
                migrationDAO,
                tagFqn,
                relativePath,
                result,
                queryTemplate,
                isForceMigration);
          } catch (Exception e) {
            LOG.error("Failed to update recognizers for tag: {}", tagFqn, e);
          }
        });

    return result;
  }

  private void updateTagRecognizers(
      Handle handle,
      MigrationDAO migrationDAO,
      String tagFqn,
      String relativePath,
      Map<String, QueryStatus> results,
      String queryTemplate,
      Boolean isForceMigration)
      throws IOException {
    Path dataPath = Paths.get(migrationFile.getDirPath(), relativePath);

    if (!Files.exists(dataPath)) {
      LOG.warn("Tag data file not found: {}", dataPath);
      return;
    }

    String jsonContent = Files.readString(dataPath);

    String updateQuery = String.format(queryTemplate, jsonContent.replace("'", "''"), tagFqn);

    String truncatedQuery = String.format(queryTemplate, "[ ... data truncated  ... ]", tagFqn);

    try {
      handle.execute(updateQuery);
      migrationDAO.upsertServerMigrationSQL(
          migrationFile.version, truncatedQuery, hash(truncatedQuery));
      results.put(
          updateQuery, new QueryStatus(QueryStatus.Status.SUCCESS, "Successfully Executed Query"));
    } catch (Exception e) {
      String message = String.format("Failed to run sql: [%s] due to [%s]", truncatedQuery, e);
      results.put(truncatedQuery, new QueryStatus(QueryStatus.Status.FAILURE, message));
      if (!isForceMigration) {
        throw new RuntimeException(message, e);
      }
    }
  }
}
