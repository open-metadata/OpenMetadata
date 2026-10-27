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

package org.openmetadata.service.migration.mysql.v210;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.migration.utils.DataMigrationStep.runOnce;
import static org.openmetadata.service.migration.utils.v206.MigrationUtil.ACTIVITY_FEED_ALERT_STEP;
import static org.openmetadata.service.migration.utils.v206.MigrationUtil.addContractAndStatusToActivityFeedAlert;
import static org.openmetadata.service.migration.utils.v207.MigrationUtil.MCP_CONSENT_COLUMNS_STEP;
import static org.openmetadata.service.migration.utils.v207.MigrationUtil.addMcpConsentColumnsOnMySql;
import static org.openmetadata.service.migration.utils.v210.AlertBacklogMigration.skipBacklogOfAlertsThePreviousReleaseCouldNotSend;
import static org.openmetadata.service.migration.utils.v210.AuthenticationSecretsEncryptionMigration.encryptAuthenticationSecrets;
import static org.openmetadata.service.migration.utils.v210.CreationAuditMigration.backfillCreationAudit;
import static org.openmetadata.service.migration.utils.v210.DataContractEntityReferenceMigration.rebuildDataContractEntityReferences;
import static org.openmetadata.service.migration.utils.v210.DataQualityDimensionMigration.backfillTestCaseDimensions;
import static org.openmetadata.service.migration.utils.v210.DeltaLakeRetirementMigration.retireDeltaLakeServices;
import static org.openmetadata.service.migration.utils.v210.DottedServiceFqnMigration.repairDottedServiceChildFqns;
import static org.openmetadata.service.migration.utils.v210.FlowableCharsetMigration.alignFlowableTableCharsets;
import static org.openmetadata.service.migration.utils.v210.IngestionPipelineMigrationUtil.backfillSourceConfigTypes;
import static org.openmetadata.service.migration.utils.v210.LifeCycleCreatedSentinelMigration.removeCreatedSentinel;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.addCreateConversationRuleToDataConsumerPolicy;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.alignHybridSearchWeightsWithDefaults;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.exemptQueryFromMultiDomainRules;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.refreshConversationNotificationTemplates;
import static org.openmetadata.service.migration.utils.v210.MlFeatureTagBackfill.backfillMlFeatureTags;
import static org.openmetadata.service.migration.utils.v210.OntologyMigration.migrateRelationshipTypes;
import static org.openmetadata.service.migration.utils.v210.SearchAggregationFieldRepair.repairFieldNamesAggregations;
import static org.openmetadata.service.migration.utils.v210.SearchTermBoostRepair.repairTermBoostSettings;

import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v210.AlertBacklogMigration;
import org.openmetadata.service.migration.utils.v210.AuthenticationSecretsEncryptionMigration;
import org.openmetadata.service.migration.utils.v210.ConsumerIdMigration;
import org.openmetadata.service.migration.utils.v210.ConversationMigration;
import org.openmetadata.service.migration.utils.v210.ConversationReferenceMigration;
import org.openmetadata.service.migration.utils.v210.CreationAuditMigration;
import org.openmetadata.service.migration.utils.v210.CustomPropertyReferenceMigration;
import org.openmetadata.service.migration.utils.v210.GlossaryAutomationReviewMigration;
import org.openmetadata.service.migration.utils.v210.LifeCycleCreatedSentinelMigration;
import org.openmetadata.service.migration.utils.v210.MigrationUtil;

public class Migration extends MigrationProcessImpl {
  public Migration(final MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    // First, so no later step loads an entity still typed DeltaLake:
    // ADR:2026-10-13-a-removed-connector-is-retired-in-the-first-data-migration-step
    retireDeltaLakeServices(handle, MYSQL, getPipelineServiceClient());
    alignFlowableTableCharsets(handle);
    ConversationMigration.migrate(handle, MYSQL);
    ConversationReferenceMigration.migrate(handle, MYSQL);
    refreshConversationNotificationTemplates();
    addCreateConversationRuleToDataConsumerPolicy(collectionDAO);
    alignHybridSearchWeightsWithDefaults();
    new MigrationUtil(handle, MYSQL).archiveLegacyThreadStorage();
    migrateRelationshipTypes(handle, MYSQL);
    // Reconcile the persisted entityRulesSettings so upgraded instances allow queries to carry the
    // multiple domains they inherit from their associated tables. Fresh installs get this from the
    // packaged JSON default; existing installs only through this migration.
    exemptQueryFromMultiDomainRules();
    backfillSourceConfigTypes(collectionDAO);
    backfillTestCaseDimensions(handle, MYSQL);
    // Retarget the stale `fieldsNames` topic/apiEndpoint aggregation field to the mapped keyword
    // fields, and split the apiEndpoint `fieldNames` aggregation into request/response field-name
    // aggregations. The seed default never reaches already-migrated clusters (per-asset
    // aggregations are not re-merged), so existing installs only get the fix through this
    // migration.
    // Idempotent.
    repairFieldNamesAggregations();
    // Existing clusters retain persisted ranking and term-boost settings, so correcting the seed
    // alone does not restore tag and certification boosts on upgrade.
    repairTermBoostSettings();
    // Repair Dashboard/Chart/Pipeline/Topic/MlModel rows created under dotted-name services before
    // 1.1.0 (the v1120 repair covered only their 7 sibling types). DB-agnostic, so also run on
    // Postgres. Re-homed here so instances already past 1.12 heal on upgrade.
    repairDottedServiceChildFqns(handle, collectionDAO);
    // Data contracts stored their entity reference as sent, usually without a name or FQN.
    // Runs after the FQN repair above so contracts copy the repaired FQNs. Idempotent.
    rebuildDataContractEntityReferences(collectionDAO);
    // entityReference / entityReferenceList values move to custom_property_reference, their only
    // home from 2.1 on, so a hard delete can remove references to the deleted entity. Restartable.
    CustomPropertyReferenceMigration.migrate(handle, collectionDAO, MYSQL);
    // MlModelRepository now indexes feature tags into tag_usage like every other type with inline
    // children. That fires only on write, so features tagged before this upgrade would read back
    // as untagged from any FQN-prefix query. Idempotent. DB-agnostic, so it runs on both engines.
    backfillMlFeatureTags(collectionDAO);
    // Authentication secrets were stored in clear text; new writes encrypt them, this encrypts what
    // is already stored. Idempotent.
    runOnce(
        migrationDAO,
        getVersion(),
        AuthenticationSecretsEncryptionMigration.STEP_NAME,
        () -> encryptAuthenticationSecrets(collectionDAO));
    runOnce(
        migrationDAO,
        getVersion(),
        CreationAuditMigration.STEP_NAME,
        () -> backfillCreationAudit(handle, MYSQL));
    runOnce(
        migrationDAO,
        getVersion(),
        LifeCycleCreatedSentinelMigration.STEP_NAME,
        () -> removeCreatedSentinel(handle, MYSQL));
    // Alerts the previous release stopped sending, because it could not build one of their
    // destinations, send again from this release; they start from the upgrade, not their backlog.
    runOnce(
        migrationDAO,
        getVersion(),
        AlertBacklogMigration.STEP_NAME,
        () -> skipBacklogOfAlertsThePreviousReleaseCouldNotSend(collectionDAO));
    // Alerts name their consumer by its registered id, no longer by its Java class.
    runOnce(
        migrationDAO,
        getVersion(),
        ConsumerIdMigration.STEP_NAME,
        () -> ConsumerIdMigration.storeConsumerIds(collectionDAO));
    // Databases already at 2.1.0 reprocess 2.0.6 for its SQL only, so its alert step never runs
    // there. The step adds only what is missing, so the 2.0.5 -> 2.1.0 path running it twice is
    // harmless.
    runOnce(
        migrationDAO,
        getVersion(),
        ACTIVITY_FEED_ALERT_STEP,
        () -> addContractAndStatusToActivityFeedAlert(handle));
    // Same for the 2.0.7 MCP consent columns. The step adds only missing columns, so running it
    // after 2.0.7 already did is harmless.
    runOnce(
        migrationDAO,
        getVersion(),
        MCP_CONSENT_COLUMNS_STEP,
        () -> addMcpConsentColumnsOnMySql(handle));
    // `migrate` runs data migrations before it starts Flowable, and this step deploys a workflow.
    runOnce(
        migrationDAO,
        getVersion(),
        GlossaryAutomationReviewMigration.STEP_NAME,
        () -> {
          initializeWorkflowHandler();
          GlossaryAutomationReviewMigration.sendAutomationProposalsToPeople();
        });
  }
}
