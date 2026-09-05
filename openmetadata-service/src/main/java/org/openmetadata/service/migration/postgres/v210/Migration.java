/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.migration.postgres.v210;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.addCreateConversationRuleToDataConsumerPolicy;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.alignHybridSearchWeightsWithDefaults;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.deployMissingGovernanceWorkflows;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.exemptQueryFromMultiDomainRules;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.refreshConversationNotificationTemplates;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.widenFlowableActivityId;
import static org.openmetadata.service.migration.utils.v210.OntologyMigration.migrateRelationshipTypes;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v210.ConversationMigration;
import org.openmetadata.service.migration.utils.v210.ConversationReferenceMigration;
import org.openmetadata.service.migration.utils.v210.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {
  public Migration(final MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    // Flowable owns its own schema, so make sure it has been created before touching it. The
    // handler is allowed to fail here (v200 tolerates the same call), in which case the widening
    // below simply finds no table and skips.
    try {
      initializeWorkflowHandler();
    } catch (Exception e) {
      LOG.warn("WorkflowHandler initialization failed in v210: {}", e.getMessage());
    }
    widenFlowableActivityId(handle, POSTGRES);
    deployMissingGovernanceWorkflows();
    ConversationMigration.migrate(handle, POSTGRES);
    ConversationReferenceMigration.migrate(handle, POSTGRES);
    refreshConversationNotificationTemplates();
    addCreateConversationRuleToDataConsumerPolicy(collectionDAO);
    alignHybridSearchWeightsWithDefaults();
    new MigrationUtil(handle, POSTGRES).archiveLegacyThreadStorage();
    migrateRelationshipTypes(handle, POSTGRES);
    // Reconcile the persisted entityRulesSettings so upgraded instances allow queries to carry the
    // multiple domains they inherit from their associated tables. Fresh installs get this from the
    // packaged JSON default; existing installs only through this migration.
    exemptQueryFromMultiDomainRules();
  }
}
