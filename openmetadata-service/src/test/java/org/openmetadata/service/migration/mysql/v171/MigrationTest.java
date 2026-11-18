package org.openmetadata.service.migration.mysql.v171;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v171.MigrationUtil;

class MigrationTest {

  private Migration newMigration() {
    return new Migration(mock(MigrationFile.class));
  }

  /**
   * On the happy path the chart update runs, the WorkflowHandler is initialized for the migration
   * context, and the workflow config backfill runs over every legacy WorkflowDefinition.
   */
  @Test
  void runDataMigrationRunsChartsThenWorkflowBackfill() {
    Migration migration = newMigration();
    Migration spy = Mockito.spy(migration);
    doNothing().when(spy).initializeWorkflowHandler();

    try (MockedStatic<MigrationUtil> util = mockStatic(MigrationUtil.class)) {
      util.when(MigrationUtil::updateServiceCharts).then(inv -> null);
      util.when(MigrationUtil::updateWorkflowDefinitions).then(inv -> null);

      assertDoesNotThrow(() -> spy.runDataMigration());

      util.verify(MigrationUtil::updateServiceCharts);
      util.verify(MigrationUtil::updateWorkflowDefinitions);
    }
  }

  /**
   * A WorkflowHandler initialization failure (e.g. a transient Flowable engine build failure
   * during a database failover) must propagate out of {@code runDataMigration()}. The migration
   * framework only skips {@link
   * org.openmetadata.service.migration.api.MigrationWorkflow#recordDataMigration} when {@code
   * runDataMigration()} throws, so swallowing the failure — as the previous try-catch did — would
   * record the version's data-migration identity and leave the backfill permanently skipped.
   */
  @Test
  void runDataMigrationPropagatesWorkflowHandlerInitFailure() {
    Migration migration = newMigration();
    Migration spy = Mockito.spy(migration);
    doThrow(new RuntimeException("workflow handler init failed"))
        .when(spy)
        .initializeWorkflowHandler();

    try (MockedStatic<MigrationUtil> util = mockStatic(MigrationUtil.class)) {
      util.when(MigrationUtil::updateServiceCharts).then(inv -> null);
      util.when(MigrationUtil::updateWorkflowDefinitions).then(inv -> null);

      assertThrows(RuntimeException.class, () -> spy.runDataMigration());

      // updateServiceCharts already ran; the config backfill never did.
      util.verify(MigrationUtil::updateServiceCharts);
      util.verify(MigrationUtil::updateWorkflowDefinitions, never());
    }
  }

  /**
   * The workflow config backfill is the ONLY step that fixes {@code config = null} on pre-1.7.1
   * WorkflowDefinitions, so its failure must propagate so the version is not recorded complete and
   * the next migrate/startup retries it. Before the fix this was swallowed, which left
   * {@code config = null} permanently and later threw a raw NullPointerException from {@code
   * config.getStoreStageStatus()} on every edit/redeploy.
   */
  @Test
  void runDataMigrationPropagatesWorkflowConfigBackfillFailure() {
    Migration migration = newMigration();
    Migration spy = Mockito.spy(migration);
    doNothing().when(spy).initializeWorkflowHandler();

    try (MockedStatic<MigrationUtil> util = mockStatic(MigrationUtil.class)) {
      util.when(MigrationUtil::updateServiceCharts).then(inv -> null);
      util.when(MigrationUtil::updateWorkflowDefinitions)
          .thenThrow(new RuntimeException("workflow backfill failed"));

      assertThrows(RuntimeException.class, () -> spy.runDataMigration());

      util.verify(MigrationUtil::updateServiceCharts);
      util.verify(MigrationUtil::updateWorkflowDefinitions);
    }
  }
}
