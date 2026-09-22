/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.tasks;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;

/**
 * Unit tests covering the Data Access Request additions to the task workflow plumbing:
 *
 * <ul>
 *   <li>The new Revoked branch on TaskEntityStatus and TaskResolutionType
 *   <li>The DataAccessRequestTaskWorkflow ↔ DataAccessRequest task type mapping
 *   <li>The DataAccess category default for DAR tasks
 *   <li>The defaultTransitionId resolution for the new revoke transition
 * </ul>
 *
 * <p>Methods that flip on these enum values inside the service ({@code
 * TaskRepository.mapResolutionToStatus}, {@code TaskWorkflowHandler.defaultWorkflowResult},
 * {@code TaskWorkflowHandler.resolveResolutionType}) are package-private and not directly
 * exercised here; they are covered indirectly through the integration tests in {@code
 * DataAccessRequestIT}. The branch coverage that matters at the unit level lives in {@link
 * TaskWorkflowLifecycleResolver}.
 */
class DataAccessRequestWorkflowTest {

  @Test
  void revokedStatusIsPresent() {
    // Sanity check that the schema regen actually produced the Revoked enum entries.
    assertEquals("Revoked", TaskEntityStatus.Revoked.value());
    assertEquals("Revoked", TaskResolutionType.Revoked.value());
  }

  @Test
  void defaultWorkflowDefinitionRefMapsDataAccessRequest() {
    assertEquals(
        "DataAccessRequestTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(
            TaskEntityType.DataAccessRequest));
  }

  @Test
  void defaultTaskTypeForDataAccessRequestWorkflow() {
    assertEquals(
        TaskEntityType.DataAccessRequest,
        TaskWorkflowLifecycleResolver.defaultTaskTypeForWorkflowDefinitionRef(
            "DataAccessRequestTaskWorkflow"));
  }

  @Test
  void defaultCategoryForDataAccessRequestWorkflow() {
    assertEquals(
        TaskCategory.DataAccess,
        TaskWorkflowLifecycleResolver.defaultTaskCategoryForWorkflowDefinitionRef(
            "DataAccessRequestTaskWorkflow"));
  }

  @Test
  void defaultTransitionIdResolvesRevokeTransitionFromAvailableTransitions() {
    Task task =
        new Task()
            .withType(TaskEntityType.DataAccessRequest)
            .withAvailableTransitions(
                List.of(
                    new TaskAvailableTransition()
                        .withId("revoke")
                        .withResolutionType(TaskResolutionType.Revoked)));

    assertEquals(
        "revoke",
        TaskWorkflowLifecycleResolver.defaultTransitionId(task, TaskResolutionType.Revoked));
  }

  @Test
  void defaultTransitionIdFallsBackToTokenWhenNoMatchingResolution() {
    // availableTransitions exist but none match Revoked → falls through to the resolution
    // → token mapping which now includes Revoked → "revoke".
    Task task =
        new Task()
            .withType(TaskEntityType.DataAccessRequest)
            .withAvailableTransitions(
                List.of(
                    new TaskAvailableTransition()
                        .withId("approve")
                        .withResolutionType(TaskResolutionType.Approved)));

    assertEquals(
        "revoke",
        TaskWorkflowLifecycleResolver.defaultTransitionId(task, TaskResolutionType.Revoked));
  }
}
