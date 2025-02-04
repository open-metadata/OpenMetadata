package org.openmetadata.service.migration.utils.v170;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  private static final String UPDATE_NULL_JSON =
      "UPDATE entity_relationship SET json = :json WHERE json IS NULL";

  private static final String UPDATE_NON_NULL_MYSQL_JSON =
      "UPDATE entity_relationship SET json = JSON_SET(json, '$.createdAt', IFNULL(CAST(json->>'$.createdAt' AS UNSIGNED), :currTime), '$.createdBy', IFNULL(JSON_UNQUOTE(json->>'$.createdBy'), 'admin'), '$.updatedAt', IFNULL(CAST(json->>'$.updatedAt' AS UNSIGNED), :currTime), '$.updatedBy', IFNULL(JSON_UNQUOTE(json->>'$.updatedBy'), 'admin')) WHERE "
          + "json IS NOT NULL AND (json->>'$.createdAt' IS NULL OR JSON_UNQUOTE(json->>'$.createdBy') IS NULL OR json->>'$.updatedAt' IS NULL OR JSON_UNQUOTE(json->>'$.updatedBy') IS NULL)";

  private static final String UPDATE_NON_NULL_POSTGRES_JSON =
      "UPDATE entity_relationship SET json = jsonb_set(jsonb_set(jsonb_set(jsonb_set(json, '{createdAt}', COALESCE((json->>'createdAt')::bigint, :currTime)::text::jsonb, true), '{createdBy}', COALESCE(json->>'createdBy', '\"admin\"')::jsonb, true), '{updatedAt}', COALESCE((json->>'updatedAt')::bigint, :currTime)::text::jsonb, true), '{updatedBy}', COALESCE(json->>'updatedBy', '\"admin\"')::jsonb, true) WHERE json IS NOT NULL AND (json->>'createdAt' IS NULL OR json->>'createdBy' IS NULL OR json->>'updatedAt' IS NULL OR json->>'updatedBy' IS NULL)";

  public static void runLineageMigrationForNullColumn(Handle handle) {
    try {
      long currentTime = System.currentTimeMillis();
      LineageDetails lineageDetails =
          new LineageDetails()
              .withCreatedAt(currentTime)
              .withUpdatedAt(currentTime)
              .withCreatedBy(ADMIN_USER_NAME)
              .withUpdatedBy(ADMIN_USER_NAME);
      int result =
          handle
              .createUpdate(UPDATE_NULL_JSON)
              .bind("json", JsonUtils.pojoToJson(lineageDetails))
              .execute();
      if (result <= 0) {
        LOG.info("No null json rows to get updated createdAt, createdBy, updatedAt and updatedBy");
      }
    } catch (Exception ex) {
      LOG.error(
          "Error while updating null json rows with createdAt, createdBy, updatedAt and updatedBy for lineage.",
          ex);
    }
  }

  public static void runLineageMigrationForNonNullColumn(Handle handle) {
    try {
      long currentTime = System.currentTimeMillis();
      String updateSql =
          Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())
              ? UPDATE_NON_NULL_MYSQL_JSON
              : UPDATE_NON_NULL_POSTGRES_JSON;
      int result = handle.createUpdate(updateSql).bind("currTime", currentTime).execute();
      if (result <= 0) {
        LOG.info(
            "No non null json rows to get updated createdAt, createdBy, updatedAt and updatedBy");
      }
    } catch (Exception ex) {
      LOG.error(
          "Error while updating non null json rows with createdAt, createdBy, updatedAt and updatedBy for lineage.",
          ex);
    }
  }
}
