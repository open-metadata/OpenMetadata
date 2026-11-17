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

package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.metadata.MetadataCollectionService;
import org.openmetadata.service.jdbi3.TaskRepository;

/**
 * An exit moves an asset off its lifecycle's onboarding path, so the lifecycle's runs on that asset
 * no longer apply: their approval tasks close and their runs end, and the asset's open tasks for
 * other stages close. It holds whatever made the move: an automatic exit, or an approved status
 * request. ADR:2026-11-16-a-lifecycle-request-triggers-only-lifecycle-playbooks
 */
@Slf4j
public final class LifecycleExitRuns {
  static final String ENDED_BY_EXIT = "The lifecycle moved this asset to %s";

  private LifecycleExitRuns() {}

  /** Called once the entity's stage has changed to {@code stage}. */
  public static void endRuns(EntityInterface<?> entity, String entityType, String stage) {
    EntityStatusWorkflows.ACTIVE
        .owningStageOf(entityType, entity)
        .flatMap(EntityStatusWorkflows::playbookWithExits)
        .filter(playbook -> EntityStatusWorkflows.exitStages(playbook).contains(stage))
        .ifPresent(playbook -> endRuns(entity, stage, playbook));
  }

  private static void endRuns(
      EntityInterface<?> entity, String stage, WorkflowDefinition playbook) {
    TaskRepository tasks = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    tasks
        .listNonTerminalTasksByEntityAndCategory(
            entity.getFullyQualifiedName(), TaskCategory.Approval)
        .stream()
        .filter(task -> isRunOf(task, playbook.getId()))
        .forEach(task -> endRun(tasks, task, stage, playbook.getName()));
    new MetadataCollectionService(
            tasks,
            Entity.getEntityReferenceByName(Entity.USER, GOVERNANCE_BOT, Include.NON_DELETED))
        .closeTasksOutside(entity, stage);
  }

  static boolean isRunOf(Task task, UUID workflowDefinitionId) {
    return workflowDefinitionId.equals(task.getWorkflowDefinitionId())
        && task.getWorkflowInstanceId() != null;
  }

  private static void endRun(TaskRepository tasks, Task task, String stage, String workflowName) {
    LOG.info(
        "[Lifecycle] Ending run '{}' of {}: the asset moved to {}",
        task.getWorkflowInstanceId(),
        workflowName,
        stage);
    tasks.closeTask(task, GOVERNANCE_BOT, ENDED_BY_EXIT.formatted(stage));
    WorkflowRunTermination.terminateOnceTaskCloses(
        workflowName, task.getId(), task.getWorkflowInstanceId());
  }
}
