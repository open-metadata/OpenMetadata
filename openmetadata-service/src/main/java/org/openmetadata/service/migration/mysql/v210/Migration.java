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
import static org.openmetadata.service.migration.utils.v210.AlertBacklogMigration.skipBacklogOfAlertsThePreviousReleaseCouldNotSend;
import static org.openmetadata.service.migration.utils.v210.AuthenticationSecretsEncryptionMigration.encryptAuthenticationSecrets;
import static org.openmetadata.service.migration.utils.v210.CreationAuditMigration.backfillCreationAudit;
import static org.openmetadata.service.migration.utils.v210.DataContractEntityReferenceMigration.rebuildDataContractEntityReferences;
import static org.openmetadata.service.migration.utils.v210.DataQualityDimensionMigration.backfillTestCaseDimensions;
import static org.openmetadata.service.migration.utils.v210.DeltaLakeRetirementMigration.retireDeltaLakeServices;
import static org.openmetadata.service.migration.utils.v210.DottedServiceFqnMigration.repairDottedServiceChildFqns;
import static org.openmetadata.service.migration.utils.v210.FlowableCharsetMigration.alignFlowableTableCharsets;
import static org.openmetadata.service.migration.utils.v210.HealthyDataAssetsChartMigration.repairHealthyDataAssetsCharts;
import static org.openmetadata.service.migration.utils.v210.IngestionPipelineMigrationUtil.backfillSourceConfigTypes;
import static org.openmetadata.service.migration.utils.v210.LifeCycleCreatedSentinelMigration.removeCreatedSentinel;
import static org.openmetadata.service.migration.utils.v210.LineageEdgePipelineCleanupMigration.clearNonPipelineEdgePipelines;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.addCreateConversationRuleToDataConsumerPolicy;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.addDenyBotUsersRuleToBotNonAdminImpersonationPolicy;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.alignHybridSearchWeightsWithDefaults;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.exemptQueryFromMultiDomainRules;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.refreshConversationNotificationTemplates;
import static org.openmetadata.service.migration.utils.v210.MlFeatureTagBackfill.backfillMlFeatureTags;
import static org.openmetadata.service.migration.utils.v210.OntologyConceptBindingMigration.copyConceptBindingsToRows;
import static org.openmetadata.service.migration.utils.v210.OntologyMigration.migrateRelationshipTypes;
import static org.openmetadata.service.migration.utils.v210.SearchAggregationFieldRepair.repairFieldNamesAggregations;
import static org.openmetadata.service.migration.utils.v210.SearchTermBoostRepair.repairTermBoostSettings;
import static org.openmetadata.service.migration.utils.v210.ServiceLineagePipelineHopRepairMigration.repairPipelineServiceHopRefcounts;

import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v208.DataProductDomainContainmentRepair;
import org.openmetadata.service.migration.utils.v208.EntityExtensionCollationAlignment;
import org.openmetadata.service.migration.utils.v208.McpGrantUserNameIndexes;
import org.openmetadata.service.migration.utils.v209.ServiceVersionSecretsMasking;
import org.openmetadata.service.migration.utils.v210.AlertBacklogMigration;
import org.openmetadata.service.migration.utils.v210.AppCreatedAlerts;
import org.openmetadata.service.migration.utils.v210.AuthenticationSecretsEncryptionMigration;
import org.openmetadata.service.migration.utils.v210.ConsumerIdMigration;
import org.openmetadata.service.migration.utils.v210.ContextFileFqnRepair;
import org.openmetadata.service.migration.utils.v210.ConversationMigration;
import org.openmetadata.service.migration.utils.v210.ConversationReferenceMigration;
import org.openmetadata.service.migration.utils.v210.CreationAuditMigration;
import org.openmetadata.service.migration.utils.v210.CustomPropertyReferenceMigration;
import org.openmetadata.service.migration.utils.v210.DataProductLineageSelfLoopRepair;
import org.openmetadata.service.migration.utils.v210.DestinationIdMigration;
import org.openmetadata.service.migration.utils.v210.FirstTimeUserMigration;
import org.openmetadata.service.migration.utils.v210.GlossaryAutomationReviewMigration;
import org.openmetadata.service.migration.utils.v210.IncidentWorkflowTransitionMigration;
import org.openmetadata.service.migration.utils.v210.LifeCycleCreatedSentinelMigration;
import org.openmetadata.service.migration.utils.v210.LineageEdgePipelineCleanupMigration;
import org.openmetadata.service.migration.utils.v210.McpConsentColumns;
import org.openmetadata.service.migration.utils.v210.MicroStrategyChartRename;
import org.openmetadata.service.migration.utils.v210.MigrationUtil;
import org.openmetadata.service.migration.utils.v210.ODCSCustomPropertiesMigration;
import org.openmetadata.service.migration.utils.v210.OntologyRolesMigration;
import org.openmetadata.service.migration.utils.v210.ServiceLineagePipelineHopRepairMigration;
import org.openmetadata.service.migration.utils.v210.TaskFieldPathMigration;
import org.openmetadata.service.migration.utils.v210.UnsupportedNotificationTemplates;
import org.openmetadata.service.migration.utils.v210.WebhookSecretsMigration;

public class Migration extends MigrationProcessImpl {
  public Migration(final MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    // First, so no later step loads an entity still typed DeltaLake:
    // ADR:2026-10-13-a-removed-connector-is-retired-in-the-first-data-migration-step
    retireDeltaLakeServices(handle, MYSQL, getPipelineServiceClient());
    ODCSCustomPropertiesMigration.migrate(handle, MYSQL);
    alignFlowableTableCharsets(handle);
    ConversationMigration.migrate(handle, MYSQL);
    ConversationReferenceMigration.migrate(handle, MYSQL);
    refreshConversationNotificationTemplates();
    addCreateConversationRuleToDataConsumerPolicy(collectionDAO);
    addDenyBotUsersRuleToBotNonAdminImpersonationPolicy(collectionDAO);
    alignHybridSearchWeightsWithDefaults();
    new MigrationUtil(handle, MYSQL).archiveLegacyThreadStorage();
    migrateRelationshipTypes(handle, MYSQL);
    copyConceptBindingsToRows(handle, MYSQL);
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
    // Task field paths take one format from 2.1 on; every stored description, tag and suggestion
    // task is rewritten into it, so readers never parse a legacy path. Idempotent.
    runOnce(
        migrationDAO,
        getVersion(),
        TaskFieldPathMigration.STEP_NAME,
        () -> TaskFieldPathMigration.migrate(handle, MYSQL));
    runOnce(
        migrationDAO,
        getVersion(),
        LifeCycleCreatedSentinelMigration.STEP_NAME,
        () -> removeCreatedSentinel(handle, MYSQL));
    // Lineage edges written before pipelines were type-restricted can name any entity — a database
    // service among them — which the edge copied into the downstream search document
    // (ANT-2026-RL0ZDKB8). Clear those references from the stored edges; each one is logged for
    // credential rotation. It runs on both engines, each with its own page query.
    runOnce(
        migrationDAO,
        getVersion(),
        LineageEdgePipelineCleanupMigration.STEP_NAME,
        () -> clearNonPipelineEdgePipelines(handle, MYSQL));
    // The v1126/v1131 backfill wrote pipeline-service hop rows with a hard-coded assetEdges=1
    // instead of the count of contributing child edges, so the first delete of any one contributor
    // removed the hop while the other children still needed it. The v2.0.3 repair skipped
    // pipeline-service pairs, so already-upgraded instances keep the wrong count. Recompute it
    // from the child edges themselves (a fixed point). DB-agnostic, so it also runs on Postgres.
    // Idempotent.
    runOnce(
        migrationDAO,
        getVersion(),
        ServiceLineagePipelineHopRepairMigration.STEP_NAME,
        () -> repairPipelineServiceHopRefcounts(collectionDAO));
    runOnce(
        migrationDAO,
        getVersion(),
        FirstTimeUserMigration.STEP_NAME,
        () -> FirstTimeUserMigration.backfillFirstTimeUser(handle, MYSQL));
    // Alerts the previous release stopped sending, because it could not build one of their
    // destinations, send again from this release; they start from the upgrade, not their backlog.
    runOnce(
        migrationDAO,
        getVersion(),
        AlertBacklogMigration.STEP_NAME,
        () -> skipBacklogOfAlertsThePreviousReleaseCouldNotSend(collectionDAO));
    // Platform Insights 'Healthy Data Assets' always showed 0%: fix the v190 chart and split out
    // its live counterpart. Idempotent.
    repairHealthyDataAssetsCharts();
    // Alerts name their consumer by its registered id, no longer by its Java class.
    runOnce(
        migrationDAO,
        getVersion(),
        ConsumerIdMigration.STEP_NAME,
        () -> ConsumerIdMigration.storeConsumerIds(collectionDAO));
    // A destination's id names one destination: shared and missing ids become its own.
    runOnce(
        migrationDAO,
        getVersion(),
        DestinationIdMigration.STEP_NAME,
        () -> DestinationIdMigration.giveEveryDestinationItsOwnId(collectionDAO));
    // New writes encrypt each webhook secret with the configured Fernet keys; these do the same
    // for what is already stored. A value a 2.1 pre-release encrypted with a key derived from its
    // destination's id is encrypted again, so they run after the destination id step. Each runs
    // once, in one transaction with the marker that records it.
    WebhookSecretsMigration.encryptProfileWebhookSecrets(handle, getVersion(), MYSQL);
    WebhookSecretsMigration.encryptAlertDestinationSecrets(handle, getVersion(), MYSQL);
    // Databases already at 2.1.0 reprocess 2.0.6 for its SQL only, so its alert step never runs
    // there. The step adds only what is missing, so the 2.0.5 -> 2.1.0 path running it twice is
    // harmless.
    runOnce(
        migrationDAO,
        getVersion(),
        ACTIVITY_FEED_ALERT_STEP,
        () -> addContractAndStatusToActivityFeedAlert(handle));
    // The MCP consent columns ship in 2.1.0, so every database upgrading to 2.1 adds them here. The
    // step adds only missing columns, so a database that already has them is left as it is.
    runOnce(
        migrationDAO,
        getVersion(),
        McpConsentColumns.STEP_NAME,
        () -> McpConsentColumns.addOnMySql(handle));
    // Same for the 2.0.8 MCP user-name indexes, on a database that recorded 2.0.8 before they were
    // added to it.
    runOnce(
        migrationDAO,
        getVersion(),
        McpGrantUserNameIndexes.STEP_NAME,
        () -> McpGrantUserNameIndexes.addOnMySql(handle));
    // Same for the 2.0.8 data product domain containment repair. The repair only rewrites links
    // that disagree, so running it after 2.0.8 already did changes nothing.
    runOnce(
        migrationDAO,
        getVersion(),
        DataProductDomainContainmentRepair.STEP_NAME,
        () -> DataProductDomainContainmentRepair.repairAll(handle, collectionDAO));
    // Renames MicroStrategy charts by dossier. It reads charts through the repository, so it runs
    // after the conversation and custom property migrations above.
    runOnce(
        migrationDAO,
        getVersion(),
        MicroStrategyChartRename.STEP_NAME,
        () -> MicroStrategyChartRename.renameAll(handle, collectionDAO));
    // Same for the 2.0.8 entity_extension collation alignment. It only acts when the column
    // differs from its table, so running it after 2.0.8 already did changes nothing.
    runOnce(
        migrationDAO,
        getVersion(),
        EntityExtensionCollationAlignment.STEP_NAME,
        () -> EntityExtensionCollationAlignment.alignOnMySql(handle));
    // `migrate` runs data migrations before it starts Flowable, and this step deploys a workflow.
    runOnce(
        migrationDAO,
        getVersion(),
        GlossaryAutomationReviewMigration.STEP_NAME,
        () -> {
          initializeWorkflowHandler();
          GlossaryAutomationReviewMigration.sendAutomationProposalsToPeople();
        });
    runOnce(
        migrationDAO,
        getVersion(),
        IncidentWorkflowTransitionMigration.STEP_NAME,
        () -> {
          initializeWorkflowHandler();
          IncidentWorkflowTransitionMigration.addAssignedStatusTransitions();
        });
    // The 2.1.0 post-data SQL disables these alerts; their names go to the log first.
    AppCreatedAlerts.logForReviewOnMySql(handle);
    UnsupportedNotificationTemplates.review(handle);
    // Seed data never reaches a role that already exists, so stewards of an installed catalog get
    // the ontology author and reviewer policies here. Idempotent.
    runOnce(
        migrationDAO,
        getVersion(),
        OntologyRolesMigration.STEP_NAME,
        () -> OntologyRolesMigration.attachOntologyPoliciesToDataSteward(collectionDAO));
    // Released versions stored a Context Center file edited inside a folder under its bare name;
    // each such file is given the FQN its folder derives again.
    runOnce(
        migrationDAO,
        getVersion(),
        ContextFileFqnRepair.STEP_NAME,
        () -> ContextFileFqnRepair.repairAll(handle, MYSQL));
    // A database that recorded 2.1.0 before the 2.0.9 masking step existed never runs 2.0.9's data
    // migration again, so the plain text secrets in its service version history are masked here.
    runOnce(
        migrationDAO,
        getVersion(),
        ServiceVersionSecretsMasking.STEP_NAME,
        () -> ServiceVersionSecretsMasking.maskPlainTextSecrets(handle, MYSQL));
    // Released versions wrote data product lineage edges from a product to itself.
    runOnce(
        migrationDAO,
        getVersion(),
        DataProductLineageSelfLoopRepair.STEP_NAME,
        () -> DataProductLineageSelfLoopRepair.deleteAll(handle, collectionDAO));
  }
}
