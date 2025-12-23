package org.openmetadata.service.migration.utils.v1114;

import java.util.List;
import java.util.Map;
import java.util.function.BiPredicate;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

/**
 * Migration utility for v1.11.4 that handles:
 * 1. Search settings boost configuration updates
 * 2. Recovery from data loss caused by running migrations with --force flag
 *
 * <p>The data loss issue: PR #23179 removed Flyway and migrated version history to
 * SERVER_CHANGE_LOG, but didn't populate SERVER_MIGRATION_SQL_LOGS with checksums. When --force
 * was used, destructive Flyway statements (DELETE FROM role_entity, etc.) were re-executed.
 */
@Slf4j
public class MigrationUtil {

  // Relationship.CONTAINS ordinal value
  private static final int CONTAINS_RELATIONSHIP = 0;

  public static void updateSearchSettingsBoostConfiguration() {
    try {
      LOG.info(
          "Updating search settings: merging percentileRank factors from default configuration");

      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();

      if (searchSettings == null) {
        LOG.warn("Search settings not found, skipping migration");
        return;
      }

      SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
      SearchSettings defaultSettings = SearchSettingsMergeUtil.loadSearchSettingsFromFile();

      if (defaultSettings == null) {
        LOG.error("Failed to load default search settings, skipping migration");
        return;
      }

      BiPredicate<String, Double> shouldMerge =
          (field, factor) -> field.contains("percentileRank") && (factor == 0.05 || factor == 0.1);

      boolean updated =
          SearchSettingsMergeUtil.mergeFieldValueBoosts(
              currentSettings, defaultSettings, shouldMerge, "percentileRank");

      if (updated) {
        SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
        LOG.info("Search settings percentileRank factors merged successfully from defaults");
      } else {
        LOG.info("No updates needed for search settings percentileRank factors");
      }

    } catch (Exception e) {
      LOG.error("Error updating search settings percentileRank factors", e);
      throw new RuntimeException("Failed to update search settings percentileRank factors", e);
    }
  }

  /**
   * Restores bot relationships for apps that lost them during the Flyway migration issue. This
   * method finds apps without bot relationships and links them to their corresponding bots based on
   * the naming convention {AppName}Bot.
   *
   * <p>Only restores relationships if they are missing (idempotent).
   */
  public static void restoreBotRelationshipsIfMissing(
      Handle handle, ConnectionType connectionType) {
    try {
      LOG.info("Checking for apps with missing bot relationships...");

      String findAppsWithoutBotQuery = getAppsWithoutBotRelationshipQuery(connectionType);
      List<Map<String, Object>> appsWithoutBot =
          handle.createQuery(findAppsWithoutBotQuery).mapToMap().list();

      if (appsWithoutBot.isEmpty()) {
        LOG.info("All apps have proper bot relationships, no restoration needed");
        return;
      }

      LOG.info(
          "Found {} apps without bot relationships, attempting restoration", appsWithoutBot.size());

      int restoredCount = 0;
      for (Map<String, Object> app : appsWithoutBot) {
        String appId = app.get("id").toString();
        String appName = app.get("name").toString();
        String expectedBotName = appName + "Bot";

        String findBotQuery = getFindBotByNameQuery(connectionType);
        List<Map<String, Object>> bots =
            handle.createQuery(findBotQuery).bind("botName", expectedBotName).mapToMap().list();

        if (bots.isEmpty()) {
          LOG.debug("No bot found with name {} for app {}", expectedBotName, appName);
          continue;
        }

        String botId = bots.get(0).get("id").toString();

        // Create the relationship (INSERT IGNORE / ON CONFLICT DO NOTHING for idempotency)
        String insertRelationshipQuery = getInsertRelationshipQuery(connectionType);
        handle
            .createUpdate(insertRelationshipQuery)
            .bind("appId", appId)
            .bind("botId", botId)
            .bind("relation", CONTAINS_RELATIONSHIP)
            .execute();

        LOG.info("Restored bot relationship for app: {} -> bot: {}", appName, expectedBotName);
        restoredCount++;
      }

      LOG.info("Restored {} app-bot relationships", restoredCount);

    } catch (Exception e) {
      LOG.error("Error restoring bot relationships: {}", e.getMessage(), e);
      // Don't fail the migration, just log the error
    }
  }

  /**
   * Checks for symptoms of data loss from the Flyway migration issue and logs recovery guidance.
   * This helps users understand if they were affected and how to recover.
   */
  public static void checkAndLogDataLossSymptoms(Handle handle) {
    try {
      LOG.info("Checking for symptoms of Flyway migration data loss...");

      int roleCount = countTable(handle, "role_entity");
      int policyCount = countTable(handle, "policy_entity");
      int appCount = countTable(handle, "installed_apps");
      int botCount = countTable(handle, "bot_entity");

      boolean potentialDataLoss = false;
      StringBuilder warnings = new StringBuilder();

      if (roleCount == 0) {
        potentialDataLoss = true;
        warnings.append("\n  - role_entity table is EMPTY. Default roles may have been deleted.");
      }

      if (policyCount == 0) {
        potentialDataLoss = true;
        warnings.append(
            "\n  - policy_entity table is EMPTY. Default policies may have been deleted.");
      }

      if (appCount > 0 && botCount == 0) {
        potentialDataLoss = true;
        warnings.append("\n  - Apps exist but no bots found. App bots may have been deleted.");
      }

      if (potentialDataLoss) {
        LOG.warn(
            """

            ============================================================
            POTENTIAL DATA LOSS DETECTED FROM FLYWAY MIGRATION ISSUE
            ============================================================
            Symptoms found:{}

            This may have occurred if you ran migrations with --force flag
            after upgrading from a pre-1.11.0 version.

            RECOVERY OPTIONS:
            1. Restore from database backup (recommended if you have one)
            2. Restart the OpenMetadata server - this will re-seed default
               roles and policies from the built-in seed data
            3. Custom roles/policies will need to be recreated manually

            For more information, see the OpenMetadata documentation.
            ============================================================
            """,
            warnings);
      } else {
        LOG.info("No data loss symptoms detected.");
      }

    } catch (Exception e) {
      LOG.debug("Could not check for data loss symptoms: {}", e.getMessage());
    }
  }

  private static int countTable(Handle handle, String tableName) {
    try {
      return handle.createQuery("SELECT COUNT(*) FROM " + tableName).mapTo(Integer.class).one();
    } catch (Exception e) {
      return -1;
    }
  }

  private static String getAppsWithoutBotRelationshipQuery(ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> """
          SELECT a.id, JSON_UNQUOTE(JSON_EXTRACT(a.json, '$.name')) as name
          FROM installed_apps a
          WHERE NOT EXISTS (
              SELECT 1 FROM entity_relationship er
              WHERE er.fromId = a.id
              AND er.toEntity = 'bot'
              AND er.relation = 0
          )
          """;
      case POSTGRES -> """
          SELECT a.id, a.json->>'name' as name
          FROM installed_apps a
          WHERE NOT EXISTS (
              SELECT 1 FROM entity_relationship er
              WHERE er.fromId = a.id
              AND er.toEntity = 'bot'
              AND er.relation = 0
          )
          """;
    };
  }

  private static String getFindBotByNameQuery(ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> """
          SELECT id FROM bot_entity
          WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')) = :botName
          """;
      case POSTGRES -> """
          SELECT id FROM bot_entity
          WHERE json->>'name' = :botName
          """;
    };
  }

  private static String getInsertRelationshipQuery(ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> """
          INSERT IGNORE INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)
          VALUES (:appId, :botId, 'application', 'bot', :relation)
          """;
      case POSTGRES -> """
          INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)
          VALUES (:appId, :botId, 'application', 'bot', :relation)
          ON CONFLICT DO NOTHING
          """;
    };
  }
}
