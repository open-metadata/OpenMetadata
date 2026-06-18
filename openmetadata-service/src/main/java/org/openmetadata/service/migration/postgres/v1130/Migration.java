package org.openmetadata.service.migration.postgres.v1130;

import static org.openmetadata.service.migration.utils.v1129.MigrationUtil.addTriggerOperationToDefaultBotPolicies;
import static org.openmetadata.service.migration.utils.v1129.MigrationUtil.addTriggerRuleToDataStewardPolicy;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1130.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    MigrationUtil.updateOwnerChartFormulas();
    try {
      MigrationUtil.migrateWebhookSecretKeyToAuthType(handle);
    } catch (Exception e) {
      LOG.error(
          "Failed to migrate webhook secretKey to authType in v1130 migration. "
              + "Webhook authentication may not work correctly until re-saved.",
          e);
    }
    try {
      MigrationUtil.migrateGlossaryTermVersionRelatedTermsToTermRelation(handle);
    } catch (Exception e) {
      LOG.error("v1130 glossaryTerm version relatedTerms transform failed; re-run to retry.", e);
    }
    MigrationUtil.addTableColumnSearchSettings();
    MigrationUtil.removeFlattenedChildrenSearchSettings();
    MigrationUtil.removeStaleFileExtensionAggregation();
    addTriggerOperationToDefaultBotPolicies(collectionDAO);
    addTriggerRuleToDataStewardPolicy(collectionDAO);
    MigrationUtil.addTaskRuleToDataConsumerPolicy(collectionDAO);
    try {
      MigrationUtil.healStuckCertificationOnEntityJson(handle, ConnectionType.POSTGRES);
    } catch (Exception e) {
      LOG.error("v1130 heal of stuck certification on entity json failed", e);
    }
  }
}
