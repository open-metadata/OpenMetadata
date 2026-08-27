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

import java.sql.ResultSet;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** Migration utility for 2.1.0 archival of legacy thread storage after task cutover. */
@Slf4j
public class MigrationUtil {
  private final Handle handle;
  private final ConnectionType connectionType;

  public MigrationUtil(Handle handle, ConnectionType connectionType) {
    this.handle = handle;
    this.connectionType = connectionType;
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
      if (QUERY_EXEMPT_DOMAIN_RULES.contains(rule.getName())
          && rule.getIgnoredEntities() != null
          && !rule.getIgnoredEntities().contains(QUERY_ENTITY)) {
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
}
