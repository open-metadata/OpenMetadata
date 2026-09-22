package org.openmetadata.service.governance.onboarding;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Stands in for the reads gate evaluation makes. Onboarding already funnels every lookup through
 * {@link OnboardingReadContext} so the board can batch them; the same seam lets a unit test drive
 * the state machine with real objects instead of mocking statics.
 */
class StubOnboardingReadContext extends OnboardingReadContext {
  private final Map<UUID, EntityInterface> entities = new HashMap<>();
  private final Map<UUID, Task> tasks = new HashMap<>();
  private final Map<UUID, WorkflowInstance> executions = new HashMap<>();
  private final Set<UUID> runningTasks = new HashSet<>();

  StubOnboardingReadContext with(EntityInterface entity) {
    entities.put(entity.getId(), entity);
    return this;
  }

  StubOnboardingReadContext with(Task task) {
    tasks.put(task.getId(), task);
    return this;
  }

  StubOnboardingReadContext with(WorkflowInstance execution) {
    executions.put(execution.getId(), execution);
    return this;
  }

  StubOnboardingReadContext running(UUID taskId) {
    runningTasks.add(taskId);
    return this;
  }

  @Override
  EntityInterface entity(EntityReference reference, String fields) {
    EntityInterface entity = entities.get(reference.getId());
    if (entity == null) throw new EntityNotFoundException("Not found: " + reference.getId());
    return entity;
  }

  @Override
  Task task(UUID id) {
    return tasks.get(id);
  }

  @Override
  WorkflowInstance execution(UUID id) {
    return executions.get(id);
  }

  @Override
  boolean activeRuntimeTask(UUID id) {
    return runningTasks.contains(id);
  }

  @Override
  boolean enabled(String type) {
    return true;
  }
}
