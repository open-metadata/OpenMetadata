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

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.LIFECYCLE_RESTART_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.AsyncService.DatabaseOperation;
import org.openmetadata.service.util.PostCommitActionQueue;

/**
 * Starts the lifecycle that owns an entity again once an approved status request moved it, so the
 * lifecycle carries on from the new stage at once instead of on the entity's next edit. Only an
 * approved request restarts it: a person decided the move, so no chain of moves can loop on its
 * own. ADR:2026-11-16-a-lifecycle-request-triggers-only-lifecycle-playbooks
 */
@Slf4j
public final class LifecycleRestart {
  private static final String SIGNAL = "lifecycleRequestApplied-%s-%s";
  private static final int MAX_ATTEMPTS = 10;
  private static final long RETRY_DELAY_MS = 500;

  private LifecycleRestart() {}

  /** Flowable signal that starts one lifecycle's trigger for one entity type. */
  public static String signalId(String workflowName, String entityType) {
    return SIGNAL.formatted(workflowName, entityType);
  }

  /**
   * Starts the lifecycle once the entity is seen in {@code movedTo}, the stage the approved request
   * moved it to: the approval's transaction may still be committing when this is called. Each look
   * runs on the shared async executor, a delayed retry rather than a wait, so no thread blocks.
   */
  public static void afterApprovedRequest(EntityReference about, String movedTo, String approver) {
    PostCommitActionQueue.runOrDefer(() -> schedule(about, movedTo, approver, 0));
  }

  private static void schedule(
      EntityReference about, String movedTo, String approver, int attempt) {
    Executor executor =
        attempt == 0
            ? Runnable::run
            : CompletableFuture.delayedExecutor(RETRY_DELAY_MS, TimeUnit.MILLISECONDS);
    executor.execute(
        () ->
            AsyncService.getInstance()
                .submitDatabaseTask(
                    DatabaseOperation.WORKFLOW_TASK,
                    about.getId().toString(),
                    () -> {
                      tryRestart(about, movedTo, approver, attempt);
                      return null;
                    })
                .exceptionally(
                    ex -> {
                      LOG.error(
                          "[Lifecycle] Failed to restart the lifecycle of '{}'", about.getId(), ex);
                      return null;
                    }));
  }

  private static void tryRestart(
      EntityReference about, String movedTo, String approver, int attempt) {
    EntityInterface<?> entity = Entity.getEntity(about, "*", Include.NON_DELETED);
    // The generated status enums print their value.
    Object stage = entity.getEntityStatus();
    if (stage != null && stage.toString().equals(movedTo)) {
      restart(about, entity, approver);
    } else if (attempt + 1 < MAX_ATTEMPTS) {
      schedule(about, movedTo, approver, attempt + 1);
    } else {
      LOG.warn(
          "[Lifecycle] {} '{}' is in {} rather than {}; its lifecycle was not restarted",
          about.getType(),
          entity.getFullyQualifiedName(),
          stage,
          movedTo);
    }
  }

  private static void restart(EntityReference about, EntityInterface<?> entity, String approver) {
    EntityStatusWorkflows.ACTIVE
        .owningStageOf(about.getType(), entity)
        .flatMap(EntityStatusWorkflows::playbookWithTransitions)
        .ifPresentOrElse(
            playbook -> {
              LOG.info(
                  "[Lifecycle] Restarting {} for {} '{}' after an approved request",
                  playbook.getName(),
                  about.getType(),
                  entity.getFullyQualifiedName());
              Map<String, Object> variables =
                  new HashMap<>(
                      WorkflowEventConsumer.runVariables(about.getType(), entity, approver));
              variables.put(
                  getNamespacedVariableName(GLOBAL_NAMESPACE, LIFECYCLE_RESTART_VARIABLE), true);
              WorkflowHandler.getInstance()
                  .triggerWithSignal(signalId(playbook.getName(), about.getType()), variables);
            },
            () ->
                LOG.debug(
                    "[Lifecycle] No lifecycle with transitions owns {} '{}'",
                    about.getType(),
                    entity.getFullyQualifiedName()));
  }
}
