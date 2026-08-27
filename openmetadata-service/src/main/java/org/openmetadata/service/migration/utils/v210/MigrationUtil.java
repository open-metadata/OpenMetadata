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
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** Migration utilities for the 2.1.0 Conversation V2 cutover and legacy thread archival. */
@Slf4j
public class MigrationUtil {
  private static final String DATA_CONSUMER_POLICY = "DataConsumerPolicy";
  private static final String CREATE_CONVERSATION_RULE_NAME =
      "DataConsumerPolicy-CreateConversation-Rule";

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
