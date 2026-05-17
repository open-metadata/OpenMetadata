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

package org.openmetadata.service.migration.utils.v201;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
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
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TaskFormSchemaRepository;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;

class MigrationUtilTest {
  private Handle handle;
  private Connection connection;
  private DatabaseMetaData metadata;
  private CollectionDAO collectionDAO;
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
    taskRepository = mock(TaskRepository.class);
    taskFormSchemaRepository = mock(TaskFormSchemaRepository.class);
    workflowDefinitionRepository = mock(WorkflowDefinitionRepository.class);
    workflowHandler = mock(WorkflowHandler.class);

    when(handle.attach(CollectionDAO.class)).thenReturn(collectionDAO);
    when(handle.getConnection()).thenReturn(connection);
    when(connection.getMetaData()).thenReturn(metadata);
    when(workflowDefinitionRepository.listAll(any(), any())).thenReturn(List.of());
    when(taskFormSchemaRepository.resolve(anyString(), any(), any())).thenReturn(Optional.empty());
  }

  @Test
  void getLegacyThreadSourceTablePrefersLegacyTable() throws Exception {
    stubTables(Set.of("thread_entity_legacy", "thread_entity_archived", "thread_entity"));

    MigrationUtil migrationUtil = newMigrationUtil();

    assertEquals("thread_entity_legacy", invokeLegacySourceTable(migrationUtil));
  }

  @Test
  void getLegacyThreadSourceTableIgnoresLiveThreadEntityAfterCutover() throws Exception {
    stubTables(Set.of("thread_entity"));

    MigrationUtil migrationUtil = newMigrationUtil();

    assertNull(invokeLegacySourceTable(migrationUtil));
  }

  @Test
  void runTaskWorkflowCutoverMigrationSkipsTaskQueryWhenLegacyTableIsAbsent() throws Exception {
    stubTables(Set.of());

    MigrationUtil migrationUtil = newMigrationUtil();

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

    MigrationUtil migrationUtil = newMigrationUtil();

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
    WorkflowDefinition recognizerWorkflow =
        new WorkflowDefinition().withName("RecognizerFeedbackReviewWorkflow");
    WorkflowDefinition unrelatedWorkflow = new WorkflowDefinition().withName("SomeOtherWorkflow");
    when(workflowDefinitionRepository.getEntitiesFromSeedData())
        .thenReturn(
            List.of(descriptionWorkflow, incidentWorkflow, recognizerWorkflow, unrelatedWorkflow));

    MigrationUtil migrationUtil = newMigrationUtil();

    migrationUtil.runTaskWorkflowCutoverMigration();

    verify(workflowDefinitionRepository).createOrUpdate(null, descriptionWorkflow, "admin");
    verify(workflowDefinitionRepository).createOrUpdate(null, incidentWorkflow, "admin");
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
            eq("DescriptionUpdateTaskWorkflow"),
            eq(org.openmetadata.schema.type.Include.NON_DELETED)))
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

      MigrationUtil migrationUtil = new MigrationUtil(handle);
      migrationUtil.runTaskWorkflowCutoverMigration();

      verify(workflowHandler)
          .triggerByKey(eq("DescriptionUpdateTaskWorkflowTrigger"), eq(taskId.toString()), any());
    }
  }

  private MigrationUtil newMigrationUtil() {
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

      return new MigrationUtil(handle);
    }
  }

  private String invokeLegacySourceTable(MigrationUtil migrationUtil) throws Exception {
    Method method = MigrationUtil.class.getDeclaredMethod("getLegacyThreadSourceTable");
    method.setAccessible(true);

    return (String) method.invoke(migrationUtil);
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
