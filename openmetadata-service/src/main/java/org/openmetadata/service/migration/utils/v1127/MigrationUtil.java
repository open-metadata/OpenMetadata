package org.openmetadata.service.migration.utils.v1127;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ConfigSourceResolver;

@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

  private static final String SELECT_SETTINGS =
      "SELECT configType, json FROM openmetadata_settings WHERE env_hash IS NULL";
  private static final String UPDATE_ENV_HASH =
      "UPDATE openmetadata_settings SET env_hash = :envHash WHERE configType = :configType";

  public static void backfillConfigSourceEnvHash(Handle handle) {
    LOG.info("Backfilling env_hash for openmetadata_settings rows");
    List<Map<String, Object>> rows = handle.createQuery(SELECT_SETTINGS).mapToMap().list();
    int success = 0;
    int failed = 0;
    for (Map<String, Object> row : rows) {
      String configType = (String) row.get("configtype");
      if (configType == null) {
        configType = (String) row.get("configType");
      }
      String json = (String) row.get("json");
      if (configType == null || json == null) {
        continue;
      }
      try {
        Object normalized = JsonUtils.readValue(json, Object.class);
        String hash = ConfigSourceResolver.computeHash(normalized);
        handle
            .createUpdate(UPDATE_ENV_HASH)
            .bind("envHash", hash)
            .bind("configType", configType)
            .execute();
        success++;
      } catch (Exception e) {
        failed++;
        LOG.warn("Failed to backfill env_hash for configType={}: {}", configType, e.getMessage());
      }
    }
    LOG.info("env_hash backfill complete: {} succeeded, {} failed", success, failed);
  }
}
