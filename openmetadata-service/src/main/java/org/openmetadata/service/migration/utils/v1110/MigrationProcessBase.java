package org.openmetadata.service.migration.utils.v1110;

import static org.openmetadata.service.util.EntityUtil.hash;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

@Slf4j
public abstract class MigrationProcessBase extends MigrationProcessImpl {
  private static final Map<String, String> PATH_BY_TAG =
      Map.of(
          "PII.Sensitive", "data/tags/Sensitive.json",
          "PII.NonSensitive", "data/tags/NonSensitive.json");

  public MigrationProcessBase(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public Map<String, QueryStatus> runPostDDLScripts(boolean isForceMigration) {
    Map<String, QueryStatus> result = super.runPostDDLScripts(isForceMigration);

    PATH_BY_TAG.forEach(
        (tagFqn, relativePath) -> {
          try {
            updateTagRecognizers(tagFqn, relativePath, result, isForceMigration);
          } catch (Exception e) {
            LOG.error("Failed to update recognizers for tag: {}", tagFqn, e);
          }
        });

    return result;
  }

  private void updateTagRecognizers(
      String tagFqn,
      String relativePath,
      Map<String, QueryStatus> results,
      Boolean isForceMigration)
      throws IOException {
    Path dataPath = Paths.get(this.getMigrationsDir(), relativePath);

    if (!Files.exists(dataPath)) {
      LOG.warn("Tag data file not found: {}", dataPath);
      return;
    }

    String jsonContent = Files.readString(dataPath);

    String queryFormat = getQueryFormat();
    String updateQuery = String.format(queryFormat, jsonContent.replace("'", "''"), tagFqn);

    String truncatedQuery = String.format(queryFormat, "[ ... data truncated  ... ]", tagFqn);

    try {
      handle.execute(updateQuery);
      migrationDAO.upsertServerMigrationSQL(getVersion(), truncatedQuery, hash(truncatedQuery));
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

  protected abstract String getQueryFormat();
}
