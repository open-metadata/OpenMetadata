package org.openmetadata.service.migration.utils.v1127;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.ConfigSourceResolver;

@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

  public static void backfillConfigSourceEnvHash(CollectionDAO collectionDAO) {
    LOG.info("Backfilling env_hash for openmetadata_settings rows");
    CollectionDAO.SystemDAO systemDAO = collectionDAO.systemDAO();
    List<Settings> allSettings = systemDAO.getAllConfig();
    int success = 0;
    int skipped = 0;
    int failed = 0;
    for (Settings setting : allSettings) {
      if (setting.getConfigType() == null || setting.getConfigValue() == null) {
        skipped++;
        continue;
      }
      String configType = setting.getConfigType().toString();
      if (systemDAO.getEnvHash(configType) != null) {
        skipped++;
        continue;
      }
      try {
        String hash = ConfigSourceResolver.computeHash(setting.getConfigValue());
        systemDAO.updateEnvHash(configType, hash);
        success++;
      } catch (Exception e) {
        failed++;
        LOG.warn("Failed to backfill env_hash for configType={}: {}", configType, e.getMessage());
      }
    }
    LOG.info(
        "env_hash backfill complete: {} succeeded, {} skipped, {} failed",
        success,
        skipped,
        failed);
  }
}
