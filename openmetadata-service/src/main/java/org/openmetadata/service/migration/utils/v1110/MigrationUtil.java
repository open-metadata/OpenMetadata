package org.openmetadata.service.migration.utils.v1110;

import static org.openmetadata.service.Entity.CLASSIFICATION;
import static org.openmetadata.service.util.EntityUtil.hash;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.classification.LoadTags;
import org.openmetadata.schema.type.Recognizer;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.utils.MigrationFile;

@Slf4j
public class MigrationUtil {
  private static final Map<String, String> PATH_BY_TAG =
      Map.of(
          "PII.Sensitive", "data/tags/Sensitive.json",
          "PII.NonSensitive", "data/tags/NonSensitive.json");
  private final MigrationFile migrationFile;

  private final ConnectionType connectionType;
  public static final String FLYWAY_TABLE_NAME = "DATABASE_CHANGE_LOG";

  public MigrationUtil(ConnectionType connectionType, MigrationFile migrationFile) {
    this.connectionType = connectionType;
    this.migrationFile = migrationFile;
  }

  public Map<String, QueryStatus> setRecognizersForSensitiveTags(
      String queryTemplate, Handle handle, MigrationDAO migrationDAO, boolean isForceMigration) {
    Map<String, QueryStatus> result = new HashMap<>();
    List<LoadTags> loadTagsList;
    try {
      loadTagsList =
          EntityRepository.getEntitiesFromSeedData(
              CLASSIFICATION, ".*json/data/tags/piiTagsWithRecognizers.json$", LoadTags.class);
    } catch (IOException e) {
      LOG.error("Failed to load tag data");
      return result;
    }

    Map<String, List<Recognizer>> recognizersByTag = new HashMap<>();
    for (LoadTags loadTags : loadTagsList) {
      String classification = loadTags.getCreateClassification().getName();
      for (CreateTag createTag : loadTags.getCreateTags()) {
        if (createTag.getAutoClassificationEnabled())
          recognizersByTag.put(
              classification + "." + createTag.getName(), createTag.getRecognizers());
      }
    }

    recognizersByTag.forEach(
        (tagFqn, recognizers) -> {
          try {
            updateTagRecognizers(
                handle, migrationDAO, tagFqn, recognizers, result, queryTemplate, isForceMigration);
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
      List<Recognizer> recognizers,
      Map<String, QueryStatus> results,
      String queryTemplate,
      Boolean isForceMigration) {
    String jsonContent = JsonUtils.pojoToJson(recognizers);

    String updateQuery = String.format(queryTemplate, jsonContent, tagFqn);

    String truncatedQuery =
        String.format(
            queryTemplate, String.format("[ ... data truncated for %s ... ]", tagFqn), tagFqn);

    try {
      handle.execute(queryTemplate, jsonContent, tagFqn);
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

  public boolean checkTableExists(Handle handle, String tableName) {
    String query =
        switch (connectionType) {
          case MYSQL -> "SELECT COUNT(*) FROM information_schema.tables "
              + "WHERE table_schema = DATABASE() AND table_name = ?";
          case POSTGRES -> "SELECT COUNT(*) FROM information_schema.tables "
              + "WHERE table_schema = current_schema() AND table_name = ?";
        };

    Integer count = handle.createQuery(query).bind(0, tableName).mapTo(Integer.class).one();

    return count > 0;
  }
}
