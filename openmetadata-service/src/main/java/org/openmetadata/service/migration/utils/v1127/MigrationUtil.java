package org.openmetadata.service.migration.utils.v1127;

import java.sql.Timestamp;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.util.ConfigSourceResolver;

@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

  public static void backfillConfigSourceEnvHash(CollectionDAO collectionDAO) {
    LOG.info("Backfilling env_hash and env_sync_timestamp for dual-source settings");
    CollectionDAO.SystemDAO systemDAO = collectionDAO.systemDAO();
    List<Settings> allSettings = systemDAO.getAllConfig();
    Timestamp migrationTime = ConfigSourceResolver.now();
    int success = 0;
    int skippedNonDualSource = 0;
    int skippedAlreadyHashed = 0;
    int failed = 0;
    for (Settings setting : allSettings) {
      if (setting.getConfigType() == null || setting.getConfigValue() == null) {
        continue;
      }
      if (!SystemRepository.isDualSourceSetting(setting.getConfigType())) {
        skippedNonDualSource++;
        continue;
      }
      String configType = setting.getConfigType().toString();
      if (systemDAO.getEnvHash(configType) != null) {
        skippedAlreadyHashed++;
        continue;
      }
      try {
        String hash = ConfigSourceResolver.computeHash(setting.getConfigValue());
        systemDAO.updateConfigMetadata(configType, hash, migrationTime, migrationTime);
        success++;
      } catch (Exception e) {
        failed++;
        LOG.warn(
            "Failed to backfill config-source metadata for configType={}: {}",
            configType,
            e.getMessage());
      }
    }
    LOG.info(
        "config-source metadata backfill complete: "
            + "{} succeeded, {} non-dual-source skipped, {} already hashed, {} failed",
        success,
        skippedNonDualSource,
        skippedAlreadyHashed,
        failed);
  }
}
