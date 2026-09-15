package org.openmetadata.service.governance.onboarding;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.google.common.collect.Lists;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.onboarding.OnboardingTaskBinding;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;

/** Request-local reads; both hits and misses are bounded even when a filter scans many batches. */
final class OnboardingBoardContext extends OnboardingReadContext {
  private record Reference(String type, UUID id, String fields) {
    Reference(EntityReference ref, String fields) {
      this(ref.getType(), ref.getId(), fields);
    }
  }

  private final Cache<Reference, Optional<EntityInterface>> entities = cache();
  private final Cache<UUID, Optional<Task>> tasks = cache();
  private final Cache<UUID, Optional<WorkflowInstance>> executions = cache();
  private final Cache<UUID, Boolean> runtimeTasks = cache();
  private final Cache<String, Boolean> enabled = cache();

  private static <K, V> Cache<K, V> cache() {
    return Caffeine.newBuilder().maximumSize(1000).build();
  }

  void preload(List<OnboardingInstance> instances, List<EntityInterface> assets) {
    List<EntityReference> assignees = new ArrayList<>();
    List<EntityReference> workflows = new ArrayList<>();
    for (var instance : instances) {
      if (instance.getCreator() != null) {
        assignees.add(instance.getCreator());
      }
      for (var gate : instance.getConfiguration().getOnboarding().getGates()) {
        for (var step : gate.getSteps()) {
          if (step.getType() == OnboardingStep.Type.APPROVAL) {
            workflows.add(
                new EntityReference()
                    .withType(Entity.WORKFLOW_DEFINITION)
                    .withId(step.getWorkflow().getId()));
          } else if (step.getAssignment() != null) {
            assignees.addAll(safe(step.getAssignment().getAssignees()));
          }
        }
      }
    }
    loadEntities(workflows, "*");
    var domains =
        assets.stream().flatMap(asset -> safe(asset.getDomains()).stream()).distinct().toList();
    loadEntities(domains, "owners");
    for (var domain : domains) {
      findEntity(domain, "owners").ifPresent(value -> assignees.addAll(safe(value.getOwners())));
    }
    for (var asset : assets) {
      assignees.addAll(safe(asset.getOwners()));
      assignees.addAll(safe(asset.getExperts()));
    }
    loadEntities(
        assignees.stream()
            .filter(Objects::nonNull)
            .filter(ref -> Entity.USER.equals(ref.getType()) || Entity.TEAM.equals(ref.getType()))
            .toList(),
        "");
    loadTasks(instances);
  }

  private void loadEntities(List<EntityReference> references, String fields) {
    var grouped =
        references.stream()
            .filter(ref -> ref.getId() != null)
            .filter(ref -> entities.getIfPresent(new Reference(ref, fields)) == null)
            .distinct()
            .collect(Collectors.groupingBy(EntityReference::getType));
    for (var group : grouped.values()) {
      for (var batch : Lists.partition(group, 100)) {
        List<EntityInterface> values = Entity.getEntities(batch, fields, Include.NON_DELETED);
        batch.forEach(ref -> entities.put(new Reference(ref, fields), Optional.empty()));
        values.forEach(
            value ->
                entities.put(
                    new Reference(value.getEntityReference(), fields), Optional.of(value)));
      }
    }
  }

  private void loadTasks(List<OnboardingInstance> instances) {
    var ids =
        instances.stream()
            .flatMap(
                instance ->
                    instance.getBindings().stream()
                        .map(OnboardingTaskBinding::getStepId)
                        .distinct()
                        .map(step -> OnboardingTasks.binding(instance, step)))
            .map(OnboardingTaskBinding::getTaskId)
            .distinct()
            .toList();
    for (var batch : Lists.partition(ids, 100)) {
      List<Task> values = Entity.getCollectionDAO().taskDAO().findEntitiesByIds(batch, Include.ALL);
      batch.forEach(id -> tasks.put(id, Optional.empty()));
      values.forEach(task -> tasks.put(task.getId(), Optional.of(task)));
      loadExecutions(values);
    }
  }

  private void loadExecutions(List<Task> values) {
    var ids =
        values.stream()
            .map(Task::getWorkflowInstanceId)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
    if (ids.isEmpty()) {
      return;
    }
    var dao = Entity.getCollectionDAO().workflowInstanceTimeSeriesDAO();
    ids.forEach(id -> executions.put(id, Optional.empty()));
    dao.getByIds(dao.getTimeSeriesTableName(), ids.stream().map(UUID::toString).toList()).stream()
        .map(json -> JsonUtils.readValue(json, WorkflowInstance.class))
        .forEach(execution -> executions.put(execution.getId(), Optional.of(execution)));
    var finished =
        values.stream()
            .filter(task -> task.getStatus() == TaskEntityStatus.Approved)
            .filter(task -> task.getWorkflowInstanceId() != null)
            .filter(
                task ->
                    Optional.ofNullable(execution(task.getWorkflowInstanceId()))
                        .filter(
                            execution ->
                                execution.getStatus() == WorkflowInstance.WorkflowStatus.FINISHED)
                        .isPresent())
            .map(Task::getId)
            .toList();
    if (!finished.isEmpty()) {
      var active = WorkflowHandler.getInstance().activeRuntimeTasks(finished);
      finished.forEach(id -> runtimeTasks.put(id, active.contains(id)));
    }
  }

  @Override
  EntityInterface entity(EntityReference reference, String fields) {
    return findEntity(reference, fields)
        .orElseThrow(() -> new EntityNotFoundException("Entity not found: " + reference.getId()));
  }

  private Optional<EntityInterface> findEntity(EntityReference reference, String fields) {
    return entities.get(
        new Reference(reference, fields),
        key -> {
          try {
            return Optional.of(super.entity(reference, fields));
          } catch (EntityNotFoundException deleted) {
            return Optional.empty();
          }
        });
  }

  @Override
  Task task(UUID id) {
    return tasks.get(id, key -> Optional.ofNullable(super.task(key))).orElse(null);
  }

  @Override
  WorkflowInstance execution(UUID id) {
    return executions.get(id, key -> Optional.ofNullable(super.execution(key))).orElse(null);
  }

  @Override
  boolean activeRuntimeTask(UUID id) {
    return runtimeTasks.get(id, super::activeRuntimeTask);
  }

  @Override
  boolean enabled(String type) {
    return enabled.get(type, super::enabled);
  }

  private static List<EntityReference> safe(List<EntityReference> references) {
    return references == null ? List.of() : references;
  }
}
