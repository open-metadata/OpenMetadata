package org.openmetadata.service.migration.utils.v171;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;

/**
 * Exercises the real {@link MigrationUtil#updateWorkflowDefinitions()} backfill against a boundary
 * mock of {@link WorkflowDefinitionRepository} (the repository boundary), not {@link MigrationUtil}
 * itself. The per-DB {@code Migration} suites verify that {@code runDataMigration()} propagates an
 * exception thrown by {@code updateWorkflowDefinitions()}; these tests verify the real backfill
 * actually throws when a per-definition {@code createOrUpdate()} write fails, so the migration is
 * not recorded complete and the next migrate/startup retries it.
 */
class MigrationUtilTest {

  @Test
  void updateWorkflowDefinitionsThrowsWhenCreateOrUpdateFails() {
    WorkflowDefinition broken = new WorkflowDefinition().withName("broken").withConfig(null);

    try (MockedConstruction<WorkflowDefinitionRepository> ignored =
        mockConstruction(
            WorkflowDefinitionRepository.class,
            (repository, context) -> {
              when(repository.listAll(any(), any())).thenReturn(List.of(broken));
              doThrow(new RuntimeException("write failed"))
                  .when(repository)
                  .createOrUpdate(isNull(), eq(broken), eq("admin"));
            })) {
      assertThrows(RuntimeException.class, MigrationUtil::updateWorkflowDefinitions);
    }
  }

  @Test
  void updateWorkflowDefinitionsCompletesWhenAllWritesSucceed() {
    WorkflowDefinition withNullConfig =
        new WorkflowDefinition().withName("nullConfig").withConfig(null);
    WorkflowDefinition withNullStoreStageStatus =
        new WorkflowDefinition()
            .withName("nullStoreStageStatus")
            .withConfig(new WorkflowConfiguration());

    try (MockedConstruction<WorkflowDefinitionRepository> ignored =
        mockConstruction(
            WorkflowDefinitionRepository.class,
            (repository, context) -> {
              when(repository.listAll(any(), any()))
                  .thenReturn(List.of(withNullConfig, withNullStoreStageStatus));
              when(repository.createOrUpdate(isNull(), any(), eq("admin"))).thenReturn(null);
            })) {
      assertDoesNotThrow(MigrationUtil::updateWorkflowDefinitions);
    }
  }
}
