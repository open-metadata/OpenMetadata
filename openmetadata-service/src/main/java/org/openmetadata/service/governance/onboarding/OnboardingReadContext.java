package org.openmetadata.service.governance.onboarding;

import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.util.RequestEntityCache;

/** Read dependencies shared by live gate evaluation and the batched board projection. */
class OnboardingReadContext {
  static final OnboardingReadContext DIRECT = new OnboardingReadContext();

  EntityInterface entity(EntityReference reference, String fields) {
    RequestEntityCache.invalidate(reference.getType(), reference.getId(), null);
    return Entity.getEntity(
        reference.getType(), reference.getId(), fields, Include.NON_DELETED, false);
  }

  /**
   * A task's assignees are relationships, not columns of its JSON row, so the committed-row read
   * comes back without them. Onboarding names the assignee everywhere ("Waiting on", the handoff
   * card), so hydrate that one field before handing the task out.
   */
  Task task(UUID id) {
    TaskRepository repository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    Task task = repository.findCommittedTask(id);
    return task == null
        ? null
        : repository.setFieldsInternal(task, repository.getFields(TaskRepository.FIELD_ASSIGNEES));
  }

  WorkflowInstance execution(UUID id) {
    return ((WorkflowInstanceRepository)
            Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE))
        .getById(id);
  }

  boolean activeRuntimeTask(UUID id) {
    return WorkflowHandler.getInstance().hasActiveRuntimeTask(id);
  }

  boolean enabled(String type) {
    return OnboardingEvaluator.isEnabled(OnboardingService.configured(type));
  }
}
