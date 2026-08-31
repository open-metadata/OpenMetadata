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
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

/** Migration utilities for the 2.1.0 upgrade. */
@Slf4j
public class MigrationUtil {
  private static final String DATA_CONSUMER_POLICY = "DataConsumerPolicy";
  private static final String CREATE_CONVERSATION_RULE_NAME =
      "DataConsumerPolicy-CreateConversation-Rule";
  private static final List<String> QUERY_EXEMPT_DOMAIN_RULES =
      List.of("Multiple Domains are not allowed", "Data Product Domain Validation");
  private static final String QUERY_ENTITY = "query";

  private static final String FLOWABLE_EVENT_SUBSCRIPTION_TABLE = "ACT_RU_EVENT_SUBSCR";
  private static final String ACTIVITY_ID_COLUMN = "ACTIVITY_ID_";
  private static final int REQUIRED_ACTIVITY_ID_LENGTH = 255;
  private static final String WIDEN_ACTIVITY_ID_MYSQL =
      "ALTER TABLE ACT_RU_EVENT_SUBSCR MODIFY COLUMN ACTIVITY_ID_ varchar(255)";
  private static final String WIDEN_ACTIVITY_ID_POSTGRES =
      "ALTER TABLE ACT_RU_EVENT_SUBSCR ALTER COLUMN ACTIVITY_ID_ TYPE varchar(255)";
  private static final String COLUMN_LENGTH_MYSQL =
      "SELECT character_maximum_length FROM information_schema.columns"
          + " WHERE table_schema = DATABASE() AND UPPER(table_name) = :tableName"
          + " AND UPPER(column_name) = :columnName";
  private static final String COLUMN_LENGTH_POSTGRES =
      "SELECT character_maximum_length FROM information_schema.columns"
          + " WHERE table_schema = current_schema() AND UPPER(table_name) = :tableName"
          + " AND UPPER(column_name) = :columnName";

  private final Handle handle;
  private final ConnectionType connectionType;

  public MigrationUtil(final Handle handle, final ConnectionType connectionType) {
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
   * Restore the activity-id width OpenMetadata's governance workflows need.
   *
   * <p>Flowable declares {@code ACT_RU_EVENT_SUBSCR.ACTIVITY_ID_} as {@code varchar(64)}. Workflow
   * activity ids generated here are longer than that, so migration 1.6.0 — which used to create
   * Flowable's schema by hand — declared the column at {@code varchar(255)}. Flowable now creates
   * and versions that schema itself, so the widening has to be re-applied or the first workflow
   * signal fails with a data-truncation error.
   *
   * <p>Deliberately Java rather than SQL: the table only exists once Flowable has initialized, and
   * that initialization is allowed to fail without aborting a migration. A plain {@code ALTER} in a
   * SQL file would turn that tolerated failure into a hard stop, so the column is inspected first
   * and left alone when Flowable has not created its schema (yet) or the width is already correct.
   */
  public static void widenFlowableActivityId(Handle handle, ConnectionType connectionType) {
    Integer currentLength = currentActivityIdLength(handle, connectionType);
    if (currentLength == null) {
      LOG.info(
          "{} not present — Flowable has not created its schema; skipping activity id widening",
          FLOWABLE_EVENT_SUBSCRIPTION_TABLE);
    } else if (currentLength >= REQUIRED_ACTIVITY_ID_LENGTH) {
      LOG.debug("{} already at {} characters", ACTIVITY_ID_COLUMN, currentLength);
    } else {
      LOG.info(
          "Widening {}.{} from {} to {} characters",
          FLOWABLE_EVENT_SUBSCRIPTION_TABLE,
          ACTIVITY_ID_COLUMN,
          currentLength,
          REQUIRED_ACTIVITY_ID_LENGTH);
      handle.execute(
          connectionType == ConnectionType.MYSQL
              ? WIDEN_ACTIVITY_ID_MYSQL
              : WIDEN_ACTIVITY_ID_POSTGRES);
    }
  }

  /**
   * Deploy stored workflow definitions that never reached Flowable.
   *
   * <p>A definition only reaches the engine through the create/update hooks on its repository, and
   * boot-time seeding calls create only for entities that do not exist yet. When a migration
   * created them first, seeding skips them and nothing deploys them — the definition sits in the
   * database and the first attempt to run it fails with "Process Definition not found". Migration
   * 1.13.1 used to cover this by redeploying everything on the way past; consolidating the pre-2.0
   * migrations into the baseline removed the only step that guaranteed it.
   *
   * <p>Only the missing ones are deployed. Redeploying indiscriminately supersedes the process
   * definition of every live workflow and resets the timer jobs behind periodic ones, which stops
   * them firing — so an already-deployed workflow is left exactly as it is.
   */
  public static int deployMissingGovernanceWorkflows() {
    int deployed = 0;
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    WorkflowHandler handler = WorkflowHandler.getInstance();
    for (WorkflowDefinition definition :
        repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter())) {
      deployed += deployIfMissing(handler, definition);
    }
    LOG.info("Deployed {} previously undeployed governance workflow definition(s)", deployed);
    return deployed;
  }

  /** One failure must not stop the rest: a single bad definition should not block the upgrade. */
  private static int deployIfMissing(WorkflowHandler handler, WorkflowDefinition definition) {
    int deployed = 0;
    try {
      if (!handler.isDeployed(definition)) {
        handler.deploy(new Workflow(definition));
        LOG.info("Deployed missing workflow '{}'", definition.getName());
        deployed = 1;
      }
    } catch (RuntimeException exception) {
      LOG.warn("Failed to deploy workflow '{}': {}", definition.getName(), exception.getMessage());
    }
    return deployed;
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
    } catch (Exception exception) {
      return false;
    }
  }

  private static Integer currentActivityIdLength(Handle handle, ConnectionType connectionType) {
    String query =
        connectionType == ConnectionType.MYSQL ? COLUMN_LENGTH_MYSQL : COLUMN_LENGTH_POSTGRES;
    return handle
        .createQuery(query)
        .bind("tableName", FLOWABLE_EVENT_SUBSCRIPTION_TABLE)
        .bind("columnName", ACTIVITY_ID_COLUMN)
        .mapTo(Integer.class)
        .findOne()
        .orElse(null);
  }
}
