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
package org.openmetadata.service.jdbi3;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.withSettings;

import jakarta.ws.rs.core.Response;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil.PutResponse;

/**
 * Integration tests cannot run inside a migration, so the migration gate on task change events is
 * covered here, with the repository's persistence calls standing in for the database.
 */
class TaskRepositoryLifecycleEventTest {

  private static final String USER = "admin";

  @Test
  void resolvingDuringAMigrationRecordsNoChangeEvent() {
    Task task = openTask();
    TaskRepository repository = repositoryPersisting(task);

    resolve(repository, task, true);

    verify(repository, never())
        .storeChangeEventForAsyncOperation(any(), any(), anyBoolean(), any());
  }

  @Test
  void resolvingOutsideAMigrationRecordsTheUpdaterChange() {
    Task task = openTask();
    TaskRepository repository = repositoryPersisting(task);

    resolve(repository, task, false);

    verify(repository)
        .storeChangeEventForAsyncOperation(task, EventType.ENTITY_UPDATED, false, USER);
  }

  private static void resolve(TaskRepository repository, Task task, boolean inMigration) {
    try (MockedStatic<WorkflowHandler> workflowHandler = mockStatic(WorkflowHandler.class)) {
      workflowHandler.when(WorkflowHandler::isMigrationContext).thenReturn(inMigration);
      repository.resolveTask(
          task, new TaskResolution().withType(TaskResolutionType.Cancelled), USER);
    }
  }

  private static Task openTask() {
    return new Task().withId(UUID.randomUUID()).withStatus(TaskEntityStatus.Open);
  }

  private static TaskRepository repositoryPersisting(Task task) {
    TaskRepository repository =
        mock(TaskRepository.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
    Fields allFields = new Fields(Set.of());
    doReturn(allFields).when(repository).getFields("*");
    doReturn(task).when(repository).get(isNull(), eq(task.getId()), eq(allFields));
    doReturn(new PutResponse<>(Response.Status.OK, task, EventType.ENTITY_UPDATED))
        .when(repository)
        .update(isNull(), any(Task.class), any(Task.class), eq(USER));
    doNothing()
        .when(repository)
        .storeChangeEventForAsyncOperation(any(), any(), anyBoolean(), any());
    return repository;
  }
}
