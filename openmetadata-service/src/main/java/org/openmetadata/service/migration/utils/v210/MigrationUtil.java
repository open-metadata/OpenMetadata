/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

/**
 * Migration utilities for 2.1.0: the Conversation V2 cutover, legacy thread archival, alignment of
 * stored hybrid search weights with the shipped defaults, and the table {@code aliases} search
 * settings backfill.
 */
@Slf4j
public class MigrationUtil {
  private static final String TABLE_ASSET_TYPE = "table";
  private static final String ALIASES_FIELD = "aliases";
  private static final String ALIASES_KEYWORD_FIELD = "aliases.keyword";
  private static final String DATA_CONSUMER_POLICY = "DataConsumerPolicy";
  private static final String CREATE_CONVERSATION_RULE_NAME =
      "DataConsumerPolicy-CreateConversation-Rule";
  private static final double PREVIOUS_KEYWORD_WEIGHT = 0.4;
  private static final double PREVIOUS_SEMANTIC_WEIGHT = 0.6;
  private static final double KEYWORD_WEIGHT = 0.6;
  private static final double SEMANTIC_WEIGHT = 0.4;
  private static final double WEIGHT_TOLERANCE = 1e-9;

  private final Handle handle;
  private final ConnectionType connectionType;

  public MigrationUtil(Handle handle, ConnectionType connectionType) {
    this.handle = handle;
    this.connectionType = connectionType;
  }

  /** Add the Conversation V2 create grant to existing DataConsumer policies. */
  public static void addCreateConversationRuleToDataConsumerPolicy(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy policy = repository.findByName(DATA_CONSUMER_POLICY, Include.NON_DELETED);
      if (policy.getRules() == null) {
        policy.setRules(new ArrayList<>());
      }
      boolean ruleExists =
          policy.getRules().stream()
              .anyMatch(rule -> CREATE_CONVERSATION_RULE_NAME.equals(rule.getName()));
      if (!ruleExists) {
        Rule rule =
            new Rule()
                .withName(CREATE_CONVERSATION_RULE_NAME)
                .withDescription("Allow authenticated users to create conversations and replies.")
                .withResources(List.of(Entity.CONVERSATION))
                .withOperations(List.of(MetadataOperation.CREATE))
                .withEffect(Rule.Effect.ALLOW);
        policy.getRules().add(rule);
        collectionDAO
            .policyDAO()
            .update(policy.getId(), policy.getFullyQualifiedName(), JsonUtils.pojoToJson(policy));
        LOG.info("Added {} rule to {}", CREATE_CONVERSATION_RULE_NAME, DATA_CONSUMER_POLICY);
      }
    } catch (EntityNotFoundException exception) {
      LOG.warn("{} not found, skipping Conversation rule backfill", DATA_CONSUMER_POLICY);
    } catch (Exception exception) {
      LOG.error(
          "Failed to add {} to {}: {}",
          CREATE_CONVERSATION_RULE_NAME,
          DATA_CONSUMER_POLICY,
          exception.getMessage(),
          exception);
    }
  }

  public static void refreshConversationNotificationTemplates() {
    try {
      NotificationTemplateRepository repository =
          (NotificationTemplateRepository) Entity.getEntityRepository(Entity.NOTIFICATION_TEMPLATE);
      repository.initOrUpdateSeedDataFromResources();
    } catch (Exception exception) {
      LOG.warn(
          "Could not refresh Conversation V2 system notification templates: {}",
          exception.getMessage());
    }
  }

  public void archiveLegacyThreadStorage() {
    if (!tableExists("thread_entity_legacy")) {
      LOG.info("No thread_entity_legacy table found, skipping legacy thread archival");
      return;
    }

    if (tableExists("thread_entity_archived")) {
      LOG.info("thread_entity_archived already exists, skipping legacy thread archival");
      return;
    }

    if (connectionType == ConnectionType.MYSQL) {
      handle.execute("RENAME TABLE thread_entity_legacy TO thread_entity_archived");
    } else {
      handle.execute("ALTER TABLE thread_entity_legacy RENAME TO thread_entity_archived");
    }

    LOG.info("Archived legacy thread storage from thread_entity_legacy to thread_entity_archived");
  }

  /**
   * Queries can legitimately belong to multiple domains: a query inherits the domain of every table
   * it is used in (see QueryRepository), so a query joining tables from different domains carries
   * more than one. The default "Multiple Domains are not allowed" / "Data Product Domain Validation"
   * rules only exempt user/team/persona/bot, so a multi-domain query round-tripped through a
   * full-body update was rejected. Fresh installs pick up the exemption from entityRulesSettings.json;
   * existing instances already have the setting persisted (SettingsCache seeds only when absent), so
   * they need this migration to reconcile the stored value. Idempotent and scoped to the two system
   * domain rules; user customizations to other rules are preserved.
   */
  public static void exemptQueryFromMultiDomainRules() {
    SystemRepository systemRepository = Entity.getSystemRepository();
    if (systemRepository == null) {
      LOG.warn("SystemRepository unavailable, skipping query multi-domain rule exemption");
      return;
    }
    Settings settings =
        systemRepository.getConfigWithKey(SettingsType.ENTITY_RULES_SETTINGS.toString());
    if (settings == null || settings.getConfigValue() == null) {
      LOG.info("entityRulesSettings not present, skipping query multi-domain rule exemption");
      return;
    }
    EntityRulesSettings rules =
        JsonUtils.readValue(
            JsonUtils.pojoToJson(settings.getConfigValue()), EntityRulesSettings.class);
    if (addQueryDomainRuleExemption(rules)) {
      settings.setConfigValue(rules);
      systemRepository.updateSetting(settings);
      LOG.info("Exempted 'query' from single-domain rules for multi-domain query inheritance");
    }
  }

  private static final List<String> QUERY_EXEMPT_DOMAIN_RULES =
      List.of("Multiple Domains are not allowed", "Data Product Domain Validation");
  private static final String QUERY_ENTITY = "query";

  /**
   * Adds {@code query} to the {@code ignoredEntities} of the single-domain rules if missing. Returns
   * true when a change was made. Pure (no I/O) so it is unit-testable.
   */
  static boolean addQueryDomainRuleExemption(EntityRulesSettings rules) {
    if (rules == null || rules.getEntitySemantics() == null) {
      return false;
    }
    boolean changed = false;
    for (SemanticsRule rule : rules.getEntitySemantics()) {
      if (!QUERY_EXEMPT_DOMAIN_RULES.contains(rule.getName())) {
        continue;
      }
      // A customized/older persisted rule may carry a null list; initialize it so the exemption is
      // never silently skipped.
      if (rule.getIgnoredEntities() == null) {
        rule.setIgnoredEntities(new ArrayList<>());
      }
      if (!rule.getIgnoredEntities().contains(QUERY_ENTITY)) {
        rule.getIgnoredEntities().add(QUERY_ENTITY);
        changed = true;
      }
    }
    return changed;
  }

  private boolean tableExists(String tableName) {
    try (ResultSet tables =
        handle
            .getConnection()
            .getMetaData()
            .getTables(null, null, tableName, new String[] {"TABLE"})) {
      while (tables.next()) {
        if (tableName.equalsIgnoreCase(tables.getString("TABLE_NAME"))) {
          return true;
        }
      }
      return false;
    } catch (Exception e) {
      return false;
    }
  }

  /**
   * Aligns the hybrid search weights in the stored search settings with the shipped defaults.
   *
   * <p>The weights are seeded into the settings row from the schema defaults on first startup, so
   * every installation carries an explicit pair that takes precedence over a later default. Only a
   * pair equal to the previous default is rewritten; any other pair is an operator choice.
   */
  public static void alignHybridSearchWeightsWithDefaults() {
    try {
      Settings storedSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      if (storedSettings == null) {
        LOG.warn("Search settings not found in database; skipping hybrid weight alignment");
      } else {
        alignStoredHybridWeights(storedSettings);
      }
    } catch (Exception e) {
      LOG.error("Error aligning hybrid search weights in stored search settings", e);
    }
  }

  private static void alignStoredHybridWeights(Settings storedSettings) {
    SearchSettings searchSettings = SearchSettingsMergeUtil.loadSearchSettings(storedSettings);
    if (swapPreviousHybridWeights(searchSettings)) {
      SearchSettingsMergeUtil.saveSearchSettings(storedSettings, searchSettings);
      LOG.info(
          "Hybrid search weights aligned to keyword={}, semantic={}",
          KEYWORD_WEIGHT,
          SEMANTIC_WEIGHT);
    } else {
      LOG.info("Stored hybrid search weights are not the previous defaults; left unchanged");
    }
  }

  /** Returns true when the previous default pair was found and swapped. */
  public static boolean swapPreviousHybridWeights(SearchSettings searchSettings) {
    GlobalSettings globalSettings = searchSettings.getGlobalSettings();
    boolean carriesPreviousDefaults =
        globalSettings != null
            && weightIs(globalSettings.getKeywordWeight(), PREVIOUS_KEYWORD_WEIGHT)
            && weightIs(globalSettings.getSemanticWeight(), PREVIOUS_SEMANTIC_WEIGHT);
    if (carriesPreviousDefaults) {
      globalSettings.setKeywordWeight(KEYWORD_WEIGHT);
      globalSettings.setSemanticWeight(SEMANTIC_WEIGHT);
    }
    return carriesPreviousDefaults;
  }

  private static boolean weightIs(Double weight, double expected) {
    return weight != null && Math.abs(weight - expected) < WEIGHT_TOLERANCE;
  }

  /**
   * Backfills the {@code aliases} / {@code aliases.keyword} searchFields and the {@code aliases}
   * highlightField onto the {@code table} assetTypeConfiguration of an already-installed
   * instance's stored searchSettings. searchSettings.json is seed data: the additive merge that
   * runs on startup only adds whole missing asset types, so a cluster upgrading from a pre-2.1.0
   * baseline keeps its old {@code table} entry forever and alias search silently returns zero
   * results even though the index document and mapping already carry the field. Idempotent; safe
   * to call on every reprocessing pass.
   */
  public static void addAliasesSearchSettings() {
    try {
      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      if (searchSettings == null) {
        LOG.warn(
            "Search settings not found in database. "
                + "Default settings will be loaded on next startup which includes table aliases.");
        return;
      }

      SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
      SearchSettings defaultSettings = SearchSettingsMergeUtil.loadSearchSettingsFromFile();
      if (defaultSettings == null) {
        LOG.error("Failed to load default search settings from file, skipping aliases migration");
        return;
      }

      if (mergeAliasesIntoTableConfiguration(currentSettings, defaultSettings)) {
        SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
        LOG.info("Added 'aliases' search field and highlight field to table search settings");
      } else {
        LOG.info("Table search settings already include 'aliases'; no updates needed");
      }
    } catch (Exception e) {
      LOG.error("Error adding aliases search settings to table configuration", e);
    }
  }

  static boolean mergeAliasesIntoTableConfiguration(
      SearchSettings currentSettings, SearchSettings defaultSettings) {
    boolean changed = false;
    AssetTypeConfiguration currentTableConfig = findTableConfiguration(currentSettings);
    AssetTypeConfiguration defaultTableConfig = findTableConfiguration(defaultSettings);
    if (currentTableConfig != null && defaultTableConfig != null) {
      changed |= mergeMissingAliasSearchFields(currentTableConfig, defaultTableConfig);
      changed |= mergeMissingAliasHighlightField(currentTableConfig, defaultTableConfig);
    }
    return changed;
  }

  private static AssetTypeConfiguration findTableConfiguration(SearchSettings settings) {
    AssetTypeConfiguration match = null;
    if (settings != null) {
      for (AssetTypeConfiguration config : listOrEmpty(settings.getAssetTypeConfigurations())) {
        if (TABLE_ASSET_TYPE.equals(config.getAssetType())) {
          match = config;
          break;
        }
      }
    }
    return match;
  }

  private static boolean mergeMissingAliasSearchFields(
      AssetTypeConfiguration currentConfig, AssetTypeConfiguration defaultConfig) {
    boolean added = false;
    List<FieldBoost> currentFields = currentConfig.getSearchFields();
    if (currentFields == null) {
      currentFields = new ArrayList<>();
      currentConfig.setSearchFields(currentFields);
    }

    Set<String> existingFieldNames = new HashSet<>();
    for (FieldBoost field : currentFields) {
      existingFieldNames.add(field.getField());
    }

    for (FieldBoost defaultField : listOrEmpty(defaultConfig.getSearchFields())) {
      boolean isAliasField =
          ALIASES_FIELD.equals(defaultField.getField())
              || ALIASES_KEYWORD_FIELD.equals(defaultField.getField());
      if (isAliasField && !existingFieldNames.contains(defaultField.getField())) {
        currentFields.add(defaultField);
        existingFieldNames.add(defaultField.getField());
        added = true;
      }
    }
    return added;
  }

  private static boolean mergeMissingAliasHighlightField(
      AssetTypeConfiguration currentConfig, AssetTypeConfiguration defaultConfig) {
    boolean added = false;
    List<String> currentHighlights = currentConfig.getHighlightFields();
    if (currentHighlights == null) {
      currentHighlights = new ArrayList<>();
      currentConfig.setHighlightFields(currentHighlights);
    }

    if (!currentHighlights.contains(ALIASES_FIELD)
        && listOrEmpty(defaultConfig.getHighlightFields()).contains(ALIASES_FIELD)) {
      currentHighlights.add(ALIASES_FIELD);
      added = true;
    }
    return added;
  }
}
