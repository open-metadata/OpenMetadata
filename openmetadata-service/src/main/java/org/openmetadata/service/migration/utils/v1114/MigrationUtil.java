package org.openmetadata.service.migration.utils.v1114;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.BiPredicate;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
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

  private static final int CONTAINS_RELATIONSHIP = 0;
  private static final int HAS_RELATIONSHIP = 10;

  private static final String APP_ROLE_NAME = "ApplicationBotRole";

  private static final Map<String, String> BOT_USER_ROLE_MAPPING =
      Map.of(
          "ingestion-bot", "IngestionBotRole",
          "profiler-bot", "ProfilerBotRole",
          "lineage-bot", "LineageBotRole",
          "usage-bot", "UsageBotRole",
          "testsuite-bot", "QualityBotRole",
          "governance-bot", "GovernanceBotRole",
          "autoClassification-bot", "AutoClassificationBotRole",
          "scim-bot", "ScimBotRole");

  private static final Map<String, List<String>> ROLE_POLICY_MAPPING =
      Map.ofEntries(
          Map.entry("DataConsumer", List.of("DataConsumerPolicy")),
          Map.entry("DataSteward", List.of("DataStewardPolicy")),
          Map.entry("DefaultBotRole", List.of("DefaultBotPolicy", "DataConsumerPolicy")),
          Map.entry("DomainOnlyAccessRole", List.of("DomainAccessPolicy")),
          Map.entry("IngestionBotRole", List.of("DefaultBotPolicy", "IngestionBotPolicy")),
          Map.entry("ProfilerBotRole", List.of("DefaultBotPolicy", "ProfilerBotPolicy")),
          Map.entry("LineageBotRole", List.of("DefaultBotPolicy", "LineageBotPolicy")),
          Map.entry("UsageBotRole", List.of("DefaultBotPolicy", "UsageBotPolicy")),
          Map.entry("QualityBotRole", List.of("DefaultBotPolicy", "QualityBotPolicy")),
          Map.entry("GovernanceBotRole", List.of("DefaultBotPolicy")),
          Map.entry(
              "AutoClassificationBotRole",
              List.of("DefaultBotPolicy", "AutoClassificationBotPolicy")),
          Map.entry("ScimBotRole", List.of("ScimBotPolicy")),
          Map.entry("ApplicationBotRole", List.of("DefaultBotPolicy", "ApplicationBotPolicy")),
          Map.entry("DataQualityBotRole", List.of("DefaultBotPolicy", "QualityBotPolicy")));

  private static final List<String> SYSTEM_POLICIES =
      Arrays.asList(
          "OrganizationPolicy",
          "DataConsumerPolicy",
          "DataStewardPolicy",
          "TeamOnlyPolicy",
          "ApplicationBotPolicy",
          "AutoClassificationBotPolicy",
          "DefaultBotPolicy",
          "DomainOnlyAccessPolicy",
          "IngestionBotPolicy",
          "LineageBotPolicy",
          "ProfilerBotPolicy",
          "QualityBotPolicy",
          "ScimBotPolicy",
          "UsageBotPolicy");

  private static final List<String> SYSTEM_ROLES =
      Arrays.asList(
          "DataConsumer",
          "DataSteward",
          "ApplicationBotRole",
          "AutoClassificationBotRole",
          "DataQualityBotRole",
          "DefaultBotRole",
          "DomainOnlyAccessRole",
          "GovernanceBotRole",
          "IngestionBotRole",
          "LineageBotRole",
          "ProfilerBotRole",
          "QualityBotRole",
          "ScimBotRole",
          "UsageBotRole");

  private static final int RESEED_THRESHOLD_PERCENT = 50;

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
    }
  }

  /**
   * Restores bot user role relationships that were deleted by the Flyway migration issue. The v004
   * migration deletes entity_relationship records where toEntity='role', which includes bot user
   * role assignments.
   */
  public static void restoreBotUserRolesIfMissing(Handle handle, ConnectionType connectionType) {
    try {
      LOG.info("Checking for bot users with missing role relationships...");

      BotRepository botRepository = (BotRepository) Entity.getEntityRepository(Entity.BOT);
      List<Bot> allBots =
          botRepository.listAll(botRepository.getFields("*"), new ListFilter(Include.ALL));

      int restoredCount = 0;
      for (Bot bot : allBots) {
        String roleName = BOT_USER_ROLE_MAPPING.getOrDefault(bot.getName(), APP_ROLE_NAME);
        String userId = findBotUserId(handle, connectionType, bot.getName().toLowerCase());
        if (userId == null) {
          LOG.debug("Bot user {} not found, skipping", bot.getName());
          continue;
        }

        String roleId = findRoleId(handle, connectionType, roleName);
        if (roleId == null) {
          LOG.debug("Role {} not found, skipping", roleName);
          continue;
        }

        if (hasUserRoleRelationship(handle, userId, roleId)) {
          LOG.debug("Bot user {} already has role {}", bot.getName(), roleName);
          continue;
        }

        String insertQuery = getInsertUserRoleRelationshipQuery(connectionType);
        handle
            .createUpdate(insertQuery)
            .bind("userId", userId)
            .bind("roleId", roleId)
            .bind("relation", HAS_RELATIONSHIP)
            .execute();

        LOG.info("Restored role {} for bot user {}", roleName, bot.getName());
        restoredCount++;
      }

      if (restoredCount > 0) {
        LOG.info("Restored {} bot user role relationships", restoredCount);
      } else {
        LOG.info("All bot users have proper role relationships");
      }

    } catch (Exception e) {
      LOG.error("Error restoring bot user roles: {}", e.getMessage(), e);
    }
  }

  /**
   * Restores role→policy relationships that were deleted by the Flyway migration issue. The v004
   * migration deletes entity_relationship records where fromEntity='role' or toEntity='role'.
   */
  public static void restoreRolePolicyRelationshipsIfMissing(
      Handle handle, ConnectionType connectionType) {
    try {
      LOG.info("Checking for roles with missing policy relationships...");

      int restoredCount = 0;
      for (Map.Entry<String, List<String>> entry : ROLE_POLICY_MAPPING.entrySet()) {
        String roleName = entry.getKey();
        List<String> policyNames = entry.getValue();

        String roleId = findRoleId(handle, connectionType, roleName);
        if (roleId == null) {
          LOG.debug("Role {} not found, skipping", roleName);
          continue;
        }

        for (String policyName : policyNames) {
          String policyId = findPolicyId(handle, connectionType, policyName);
          if (policyId == null) {
            LOG.debug("Policy {} not found, skipping", policyName);
            continue;
          }

          if (hasRolePolicyRelationship(handle, roleId, policyId)) {
            continue;
          }

          String insertQuery = getInsertRolePolicyRelationshipQuery(connectionType);
          handle
              .createUpdate(insertQuery)
              .bind("roleId", roleId)
              .bind("policyId", policyId)
              .bind("relation", HAS_RELATIONSHIP)
              .execute();

          LOG.info("Restored policy {} for role {}", policyName, roleName);
          restoredCount++;
        }
      }

      if (restoredCount > 0) {
        LOG.info("Restored {} role-policy relationships", restoredCount);
      } else {
        LOG.info("All roles have proper policy relationships");
      }

    } catch (Exception e) {
      LOG.error("Error restoring role-policy relationships: {}", e.getMessage(), e);
    }
  }

  private static String findPolicyId(
      Handle handle, ConnectionType connectionType, String policyName) {
    String query = getCheckPolicyExistsQuery(connectionType).replace("COUNT(*)", "id");
    List<Map<String, Object>> results =
        handle.createQuery(query).bind("name", policyName).mapToMap().list();
    return results.isEmpty() ? null : results.get(0).get("id").toString();
  }

  private static boolean hasRolePolicyRelationship(Handle handle, String roleId, String policyId) {
    String query =
        """
        SELECT COUNT(*) as cnt FROM entity_relationship
        WHERE fromId = :roleId AND toId = :policyId
        AND fromEntity = 'role' AND toEntity = 'policy' AND relation = :relation
        """;
    Integer count =
        handle
            .createQuery(query)
            .bind("roleId", roleId)
            .bind("policyId", policyId)
            .bind("relation", HAS_RELATIONSHIP)
            .mapTo(Integer.class)
            .one();
    return count != null && count > 0;
  }

  private static String getInsertRolePolicyRelationshipQuery(ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> """
          INSERT IGNORE INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)
          VALUES (:roleId, :policyId, 'role', 'policy', :relation)
          """;
      case POSTGRES -> """
          INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)
          VALUES (:roleId, :policyId, 'role', 'policy', :relation)
          ON CONFLICT DO NOTHING
          """;
    };
  }

  private static String findBotUserId(
      Handle handle, ConnectionType connectionType, String userName) {
    String query =
        switch (connectionType) {
          case MYSQL -> """
          SELECT id FROM user_entity
          WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')) = :name
          AND JSON_EXTRACT(json, '$.isBot') = true
          """;
          case POSTGRES -> """
          SELECT id FROM user_entity
          WHERE json->>'name' = :name
          AND (json->>'isBot')::boolean = true
          """;
        };
    List<Map<String, Object>> results =
        handle.createQuery(query).bind("name", userName).mapToMap().list();
    return results.isEmpty() ? null : results.get(0).get("id").toString();
  }

  private static String findRoleId(Handle handle, ConnectionType connectionType, String roleName) {
    String query = getCheckRoleExistsQuery(connectionType).replace("COUNT(*)", "id");
    List<Map<String, Object>> results =
        handle.createQuery(query).bind("name", roleName).mapToMap().list();
    return results.isEmpty() ? null : results.get(0).get("id").toString();
  }

  private static boolean hasUserRoleRelationship(Handle handle, String userId, String roleId) {
    String query =
        """
        SELECT COUNT(*) as cnt FROM entity_relationship
        WHERE fromId = :userId AND toId = :roleId
        AND fromEntity = 'user' AND toEntity = 'role' AND relation = :relation
        """;
    Integer count =
        handle
            .createQuery(query)
            .bind("userId", userId)
            .bind("roleId", roleId)
            .bind("relation", HAS_RELATIONSHIP)
            .mapTo(Integer.class)
            .one();
    return count != null && count > 0;
  }

  private static String getInsertUserRoleRelationshipQuery(ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> """
          INSERT IGNORE INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)
          VALUES (:userId, :roleId, 'user', 'role', :relation)
          """;
      case POSTGRES -> """
          INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)
          VALUES (:userId, :roleId, 'user', 'role', :relation)
          ON CONFLICT DO NOTHING
          """;
    };
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

  /**
   * Re-seeds default system roles and policies if a significant number are missing. This recovers
   * from data loss caused by the Flyway migration --force issue. Re-seeds if more than 50% of
   * system policies/roles are missing - does not override existing data.
   */
  public static void reseedRolesAndPoliciesIfMissing(Handle handle, ConnectionType connectionType) {
    try {
      List<String> missingPolicies = findMissingSystemPolicies(handle, connectionType);
      List<String> missingRoles = findMissingSystemRoles(handle, connectionType);

      int missingPolicyPercent = (missingPolicies.size() * 100) / SYSTEM_POLICIES.size();
      int missingRolePercent = (missingRoles.size() * 100) / SYSTEM_ROLES.size();

      if (missingPolicyPercent >= RESEED_THRESHOLD_PERCENT) {
        LOG.info(
            "Missing {}% of system policies ({}). Re-seeding default policies...",
            missingPolicyPercent, missingPolicies);
        reseedPolicies();
      } else if (!missingPolicies.isEmpty()) {
        LOG.info(
            "Some system policies missing ({}) but below threshold, skipping re-seed",
            missingPolicies);
      }

      if (missingRolePercent >= RESEED_THRESHOLD_PERCENT) {
        LOG.info(
            "Missing {}% of system roles ({}). Re-seeding default roles...",
            missingRolePercent, missingRoles);
        reseedRoles();
      } else if (!missingRoles.isEmpty()) {
        LOG.info(
            "Some system roles missing ({}) but below threshold, skipping re-seed", missingRoles);
      }

      if (missingPolicies.isEmpty() && missingRoles.isEmpty()) {
        LOG.info("All system roles and policies exist, skipping re-seed");
      }
    } catch (Exception e) {
      LOG.error("Error checking/re-seeding roles and policies: {}", e.getMessage(), e);
    }
  }

  private static List<String> findMissingSystemPolicies(
      Handle handle, ConnectionType connectionType) {
    String query = getCheckPolicyExistsQuery(connectionType);
    return SYSTEM_POLICIES.stream()
        .filter(
            policyName -> {
              Integer count =
                  handle.createQuery(query).bind("name", policyName).mapTo(Integer.class).one();
              return count == null || count == 0;
            })
        .toList();
  }

  private static List<String> findMissingSystemRoles(Handle handle, ConnectionType connectionType) {
    String query = getCheckRoleExistsQuery(connectionType);
    return SYSTEM_ROLES.stream()
        .filter(
            roleName -> {
              Integer count =
                  handle.createQuery(query).bind("name", roleName).mapTo(Integer.class).one();
              return count == null || count == 0;
            })
        .toList();
  }

  private static String getCheckPolicyExistsQuery(ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> """
          SELECT COUNT(*) FROM policy_entity
          WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')) = :name
          """;
      case POSTGRES -> """
          SELECT COUNT(*) FROM policy_entity
          WHERE json->>'name' = :name
          """;
    };
  }

  private static String getCheckRoleExistsQuery(ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> """
          SELECT COUNT(*) FROM role_entity
          WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')) = :name
          """;
      case POSTGRES -> """
          SELECT COUNT(*) FROM role_entity
          WHERE json->>'name' = :name
          """;
    };
  }

  private static void reseedPolicies() {
    try {
      EntityRepository<Policy> policyRepository =
          (EntityRepository<Policy>) Entity.getEntityRepository(Entity.POLICY);
      List<Policy> policies = policyRepository.getEntitiesFromSeedData();
      int seeded = 0;
      for (Policy policy : policies) {
        try {
          policyRepository.initializeEntity(policy);
          seeded++;
        } catch (Exception e) {
          LOG.debug("Policy already exists or failed to seed: {}", e.getMessage());
        }
      }
      LOG.info("Re-seeded {} default policies", seeded);
    } catch (Exception e) {
      LOG.error("Failed to re-seed policies: {}", e.getMessage(), e);
    }
  }

  private static void reseedRoles() {
    try {
      EntityRepository<Role> roleRepository =
          (EntityRepository<Role>) Entity.getEntityRepository(Entity.ROLE);
      List<Role> roles = roleRepository.getEntitiesFromSeedData();
      int seeded = 0;
      for (Role role : roles) {
        try {
          roleRepository.initializeEntity(role);
          seeded++;
        } catch (Exception e) {
          LOG.debug("Role already exists or failed to seed: {}", e.getMessage());
        }
      }
      LOG.info("Re-seeded {} default roles", seeded);
    } catch (Exception e) {
      LOG.error("Failed to re-seed roles: {}", e.getMessage(), e);
    }
  }
}
