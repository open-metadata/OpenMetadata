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

package org.openmetadata.service.migration.utils.v200;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TaskFormSchemaRepository;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;

class MigrationUtilTaskWorkflowTest {
  private Handle handle;
  private Connection connection;
  private DatabaseMetaData metadata;
  private CollectionDAO collectionDAO;
  private CollectionDAO.TaskDAO taskDAO;
  private TaskRepository taskRepository;
  private TaskFormSchemaRepository taskFormSchemaRepository;
  private WorkflowDefinitionRepository workflowDefinitionRepository;
  private WorkflowHandler workflowHandler;

  @BeforeEach
  void setUp() throws Exception {
    handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    connection = mock(Connection.class);
    metadata = mock(DatabaseMetaData.class);
    collectionDAO = mock(CollectionDAO.class);
    taskDAO = mock(CollectionDAO.TaskDAO.class);
    taskRepository = mock(TaskRepository.class);
    taskFormSchemaRepository = mock(TaskFormSchemaRepository.class);
    workflowDefinitionRepository = mock(WorkflowDefinitionRepository.class);
    workflowHandler = mock(WorkflowHandler.class);

    when(handle.attach(CollectionDAO.class)).thenReturn(collectionDAO);
    when(collectionDAO.taskDAO()).thenReturn(taskDAO);
    when(handle.getConnection()).thenReturn(connection);
    when(connection.getMetaData()).thenReturn(metadata);
    when(workflowDefinitionRepository.listAll(any(), any())).thenReturn(List.of());
    when(taskFormSchemaRepository.resolve(anyString(), any(), any())).thenReturn(Optional.empty());
  }

  @Test
  void getLegacyThreadSourceTablePrefersLegacyTable() throws Exception {
    stubTables(Set.of("thread_entity_legacy", "thread_entity_archived", "thread_entity"));

    MigrationUtil.TaskWorkflow migrationUtil = newMigrationUtil();

    assertEquals("thread_entity_legacy", invokeLegacySourceTable(migrationUtil));
  }

  @Test
  void getLegacyThreadSourceTableIgnoresLiveThreadEntityAfterCutover() throws Exception {
    stubTables(Set.of("thread_entity"));

    MigrationUtil.TaskWorkflow migrationUtil = newMigrationUtil();

    assertNull(invokeLegacySourceTable(migrationUtil));
  }

  @Test
  void runTaskWorkflowCutoverMigrationSkipsTaskQueryWhenLegacyTableIsAbsent() throws Exception {
    stubTables(Set.of());

    MigrationUtil.TaskWorkflow migrationUtil = newMigrationUtil();

    assertDoesNotThrow(migrationUtil::runTaskWorkflowCutoverMigration);
    verify(handle, never()).createQuery(anyString());
    verify(taskRepository, never()).create(any(), any());
  }

  @Test
  void runTaskWorkflowCutoverMigrationRedeploysApprovalWorkflows() throws Exception {
    stubTables(Set.of());
    WorkflowNodeDefinitionInterface approvalNode = mock(WorkflowNodeDefinitionInterface.class);
    when(approvalNode.getSubType()).thenReturn("userApprovalTask");
    WorkflowDefinition workflowDefinition =
        new WorkflowDefinition().withName("ApprovalWorkflow").withNodes(List.of(approvalNode));
    when(workflowDefinitionRepository.listAll(any(), any()))
        .thenReturn(List.of(workflowDefinition));

    MigrationUtil.TaskWorkflow migrationUtil = newMigrationUtil();

    migrationUtil.runTaskWorkflowCutoverMigration();

    verify(workflowDefinitionRepository).createOrUpdate(null, workflowDefinition, "admin");
    verify(handle, never()).createQuery(anyString());
  }

  @Test
  void runTaskWorkflowCutoverMigrationSeedsPerTaskWorkflowDefaults() throws Exception {
    stubTables(Set.of());
    WorkflowDefinition descriptionWorkflow =
        new WorkflowDefinition().withName("DescriptionUpdateTaskWorkflow");
    WorkflowDefinition incidentWorkflow =
        new WorkflowDefinition().withName("IncidentResolutionTaskWorkflow");
    WorkflowDefinition dataQualityWorkflow =
        new WorkflowDefinition().withName("DataQualityReviewTaskWorkflow");
    WorkflowDefinition recognizerWorkflow =
        new WorkflowDefinition().withName("RecognizerFeedbackReviewWorkflow");
    WorkflowDefinition unrelatedWorkflow = new WorkflowDefinition().withName("SomeOtherWorkflow");
    when(workflowDefinitionRepository.getEntitiesFromSeedData())
        .thenReturn(
            List.of(
                descriptionWorkflow,
                incidentWorkflow,
                dataQualityWorkflow,
                recognizerWorkflow,
                unrelatedWorkflow));

    MigrationUtil.TaskWorkflow migrationUtil = newMigrationUtil();

    migrationUtil.runTaskWorkflowCutoverMigration();

    verify(workflowDefinitionRepository).createOrUpdate(null, descriptionWorkflow, "admin");
    verify(workflowDefinitionRepository).createOrUpdate(null, incidentWorkflow, "admin");
    verify(workflowDefinitionRepository).createOrUpdate(null, dataQualityWorkflow, "admin");
    verify(workflowDefinitionRepository).createOrUpdate(null, recognizerWorkflow, "admin");
    verify(workflowDefinitionRepository, never()).createOrUpdate(null, unrelatedWorkflow, "admin");
  }

  @Test
  void runTaskWorkflowCutoverMigrationBackfillsOpenTasksToWorkflowInstances() throws Exception {
    stubTables(Set.of());
    UUID taskId = UUID.randomUUID();
    Task openTask =
        new Task()
            .withId(taskId)
            .withName("description-update")
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withAbout(
                new EntityReference()
                    .withType("table")
                    .withFullyQualifiedName("sample_data.ecommerce_db.shopify.raw_product_catalog"))
            .withUpdatedBy("alice");

    WorkflowDefinition workflowDefinition =
        new WorkflowDefinition()
            .withId(UUID.randomUUID())
            .withName("DescriptionUpdateTaskWorkflow")
            .withFullyQualifiedName("DescriptionUpdateTaskWorkflow");

    when(taskRepository.listAll(any(), any())).thenReturn(List.of(openTask));
    when(workflowDefinitionRepository.findByNameOrNull(
            eq("DescriptionUpdateTaskWorkflow"), eq(Include.NON_DELETED)))
        .thenReturn(workflowDefinition);
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<WorkflowHandler> workflowMock = mockStatic(WorkflowHandler.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(taskRepository);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(taskFormSchemaRepository);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
          .thenReturn(workflowDefinitionRepository);
      workflowMock.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);

      MigrationUtil.TaskWorkflow migrationUtil = new MigrationUtil.TaskWorkflow(handle);
      migrationUtil.runTaskWorkflowCutoverMigration();

      verify(workflowHandler)
          .triggerByKey(eq("DescriptionUpdateTaskWorkflowTrigger"), eq(taskId.toString()), any());
    }
  }

  @Test
  void runTaskWorkflowCutoverMigrationRewritesRecognizerFeedbackTasksBeforeBackfill()
      throws Exception {
    stubTables(Set.of());
    UUID taskId = UUID.randomUUID();
    Task openTask = recognizerFeedbackDataQualityTask(taskId, "PII.Email");

    WorkflowDefinition workflowDefinition =
        new WorkflowDefinition()
            .withId(UUID.randomUUID())
            .withName("RecognizerFeedbackReviewWorkflow")
            .withFullyQualifiedName("RecognizerFeedbackReviewWorkflow");

    when(taskRepository.listAll(any(), any())).thenReturn(List.of(openTask));
    when(workflowDefinitionRepository.findByNameOrNull(
            eq("RecognizerFeedbackReviewWorkflow"), eq(Include.NON_DELETED)))
        .thenReturn(workflowDefinition);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<WorkflowHandler> workflowMock = mockStatic(WorkflowHandler.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(taskRepository);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(taskFormSchemaRepository);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
          .thenReturn(workflowDefinitionRepository);
      workflowMock.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);

      MigrationUtil.TaskWorkflow migrationUtil = new MigrationUtil.TaskWorkflow(handle);
      migrationUtil.runTaskWorkflowCutoverMigration();

      assertEquals(TaskEntityType.RecognizerFeedbackApproval, openTask.getType());
      verify(taskDAO)
          .updateTask(eq(taskId.toString()), contains("\"type\":\"RecognizerFeedbackApproval\""));
      verify(workflowHandler)
          .triggerByKey(
              eq("RecognizerFeedbackReviewWorkflowTrigger"), eq(taskId.toString()), any());
    }
  }

  @Test
  void runRecognizerFeedbackTaskTypeMigrationContinuesAfterSingleRewriteFailure() throws Exception {
    UUID failingTaskId = UUID.randomUUID();
    UUID rewrittenTaskId = UUID.randomUUID();
    Task failingTask = recognizerFeedbackDataQualityTask(failingTaskId, "PII.Email");
    Task rewrittenTask = recognizerFeedbackDataQualityTask(rewrittenTaskId, "PII.Phone");

    when(workflowDefinitionRepository.getEntitiesFromSeedData()).thenReturn(List.of());
    when(taskRepository.listAll(any(), any())).thenReturn(List.of(failingTask, rewrittenTask));
    doThrow(new RuntimeException("update failed"))
        .when(taskDAO)
        .updateTask(eq(failingTaskId.toString()), anyString());

    MigrationUtil.TaskWorkflow migrationUtil = newMigrationUtil();

    migrationUtil.runRecognizerFeedbackTaskTypeMigration();

    assertEquals(TaskEntityType.DataQualityReview, failingTask.getType());
    assertEquals(TaskEntityType.RecognizerFeedbackApproval, rewrittenTask.getType());
    verify(taskDAO)
        .updateTask(
            eq(failingTaskId.toString()), contains("\"type\":\"RecognizerFeedbackApproval\""));
    verify(taskDAO)
        .updateTask(
            eq(rewrittenTaskId.toString()), contains("\"type\":\"RecognizerFeedbackApproval\""));
  }

  @Test
  void runRecognizerFeedbackTaskTypeMigrationSeedsDataQualityWorkflow() throws Exception {
    WorkflowDefinition dataQualityWorkflow =
        new WorkflowDefinition().withName("DataQualityReviewTaskWorkflow");
    WorkflowDefinition recognizerWorkflow =
        new WorkflowDefinition().withName("RecognizerFeedbackReviewWorkflow");
    WorkflowDefinition unrelatedWorkflow = new WorkflowDefinition().withName("SomeOtherWorkflow");
    when(workflowDefinitionRepository.getEntitiesFromSeedData())
        .thenReturn(List.of(dataQualityWorkflow, recognizerWorkflow, unrelatedWorkflow));
    when(taskRepository.listAll(any(), any())).thenReturn(List.of());

    MigrationUtil.TaskWorkflow migrationUtil = newMigrationUtil();

    migrationUtil.runRecognizerFeedbackTaskTypeMigration();

    verify(workflowDefinitionRepository).createOrUpdate(null, dataQualityWorkflow, "admin");
    verify(workflowDefinitionRepository).createOrUpdate(null, recognizerWorkflow, "admin");
    verify(workflowDefinitionRepository, never()).createOrUpdate(null, unrelatedWorkflow, "admin");
  }

  private MigrationUtil.TaskWorkflow newMigrationUtil() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<WorkflowHandler> workflowMock = mockStatic(WorkflowHandler.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(taskRepository);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(taskFormSchemaRepository);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
          .thenReturn(workflowDefinitionRepository);
      workflowMock.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);

      return new MigrationUtil.TaskWorkflow(handle);
    }
  }

  private String invokeLegacySourceTable(MigrationUtil.TaskWorkflow migrationUtil)
      throws Exception {
    Method method =
        MigrationUtil.TaskWorkflow.class.getDeclaredMethod("getLegacyThreadSourceTable");
    method.setAccessible(true);

    return (String) method.invoke(migrationUtil);
  }

  private Task recognizerFeedbackDataQualityTask(UUID taskId, String tagFqn) {
    return new Task()
        .withId(taskId)
        .withName("recognizer-feedback")
        .withType(TaskEntityType.DataQualityReview)
        .withCategory(TaskCategory.Review)
        .withStatus(TaskEntityStatus.Open)
        .withAbout(new EntityReference().withType("tag").withFullyQualifiedName(tagFqn))
        .withUpdatedBy("alice")
        .withPayload(
            Map.of(
                "feedback",
                Map.of(
                    "tagFQN",
                    tagFqn,
                    "entityLink",
                    "<#E::table::sample_data.ecommerce_db.shopify.raw_product_catalog::tags>")));
  }

  private void stubTables(Set<String> tables) throws Exception {
    when(metadata.getTables(any(), any(), anyString(), any()))
        .thenAnswer(
            invocation -> {
              String tableName = invocation.getArgument(2);
              ResultSet resultSet = mock(ResultSet.class);

              if (tables.contains(tableName)) {
                when(resultSet.next()).thenReturn(true, false);
                when(resultSet.getString("TABLE_NAME")).thenReturn(tableName);
              } else {
                when(resultSet.next()).thenReturn(false);
              }

              return resultSet;
            });
  }
}
