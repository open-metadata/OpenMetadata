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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.CONTAINER;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;
import static org.openmetadata.service.util.EntityUtil.taskMatch;

import java.util.ArrayList;
import java.util.List;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.pipelines.PipelineResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

public class PipelineRepository extends EntityRepository<Pipeline> {
  private static final String TASKS_FIELD = "tasks";
  private static final String PIPELINE_UPDATE_FIELDS = "tasks";
  private static final String PIPELINE_PATCH_FIELDS = "tasks,sourceHash";
  public static final String PIPELINE_STATUS_EXTENSION = "pipeline.pipelineStatus";

  public PipelineRepository() {
    super(
        PipelineResource.COLLECTION_PATH,
        Entity.PIPELINE,
        Pipeline.class,
        Entity.getCollectionDAO().pipelineDAO(),
        PIPELINE_PATCH_FIELDS,
        PIPELINE_UPDATE_FIELDS);
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(Pipeline pipeline) {
    pipeline.setFullyQualifiedName(
        FullyQualifiedName.add(pipeline.getService().getFullyQualifiedName(), pipeline.getName()));
    setTaskFQN(pipeline.getFullyQualifiedName(), pipeline.getTasks());
  }

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    EntityLink entityLink = threadContext.getAbout();
    if (entityLink.getFieldName().equals(TASKS_FIELD)) {
      TaskType taskType = threadContext.getThread().getTask().getType();
      if (EntityUtil.isDescriptionTask(taskType)) {
        return new TaskDescriptionWorkflow(threadContext);
      } else if (EntityUtil.isTagTask(taskType)) {
        return new TaskTagWorkflow(threadContext);
      } else {
        throw new IllegalArgumentException(String.format("Invalid task type %s", taskType));
      }
    }
    return super.getTaskWorkflow(threadContext);
  }

  static class TaskDescriptionWorkflow extends DescriptionTaskWorkflow {
    private final Task task;

    TaskDescriptionWorkflow(ThreadContext threadContext) {
      super(threadContext);
      Pipeline pipeline =
          Entity.getEntity(CONTAINER, threadContext.getAboutEntity().getId(), "tasks", ALL);
      threadContext.setAboutEntity(pipeline);
      task = findTask(pipeline.getTasks(), threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      task.setDescription(resolveTask.getNewValue());
      return threadContext.getAboutEntity();
    }
  }

  static class TaskTagWorkflow extends TagTaskWorkflow {
    private final Task task;

    TaskTagWorkflow(ThreadContext threadContext) {
      super(threadContext);
      Pipeline pipeline =
          Entity.getEntity(CONTAINER, threadContext.getAboutEntity().getId(), "tasks,tags", ALL);
      threadContext.setAboutEntity(pipeline);
      task = findTask(pipeline.getTasks(), threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      List<TagLabel> tags = JsonUtils.readObjects(resolveTask.getNewValue(), TagLabel.class);
      task.setTags(tags);
      return threadContext.getAboutEntity();
    }
  }

  @Override
  public void setFields(Pipeline pipeline, Fields fields) {
    pipeline.setService(getContainer(pipeline.getId()));
    pipeline.setSourceHash(fields.contains("sourceHash") ? pipeline.getSourceHash() : null);
    getTaskTags(fields.contains(FIELD_TAGS), pipeline.getTasks());
    pipeline.withPipelineStatus(
        fields.contains("pipelineStatus")
            ? getPipelineStatus(pipeline)
            : pipeline.getPipelineStatus());
  }

  @Override
  public void clearFields(Pipeline pipeline, Fields fields) {
    pipeline.withTasks(fields.contains(TASKS_FIELD) ? pipeline.getTasks() : null);
    pipeline.withPipelineStatus(
        fields.contains("pipelineStatus") ? pipeline.getPipelineStatus() : null);
  }

  private PipelineStatus getPipelineStatus(Pipeline pipeline) {
    return JsonUtils.readValue(
        getLatestExtensionFromTimeseries(
            pipeline.getFullyQualifiedName(), PIPELINE_STATUS_EXTENSION),
        PipelineStatus.class);
  }

  public Pipeline addPipelineStatus(String fqn, PipelineStatus pipelineStatus) {
    // Validate the request content
    Pipeline pipeline = daoCollection.pipelineDAO().findEntityByName(fqn);
    pipeline.setService(getContainer(pipeline.getId()));

    // validate all the Tasks
    for (Status taskStatus : pipelineStatus.getTaskStatus()) {
      validateTask(pipeline, taskStatus.getName());
    }

    // Pipeline status is from the pipeline execution. There is no gurantee that it is unique as it
    // is unrelated to
    // workflow execution. We should bring back the old behavior for this one.
    String storedPipelineStatus =
        getExtensionAtTimestamp(fqn, PIPELINE_STATUS_EXTENSION, pipelineStatus.getTimestamp());
    if (storedPipelineStatus != null) {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .update(
              pipeline.getFullyQualifiedName(),
              PIPELINE_STATUS_EXTENSION,
              JsonUtils.pojoToJson(pipelineStatus),
              pipelineStatus.getTimestamp());
    } else {
      storeTimeSeries(
          pipeline.getFullyQualifiedName(),
          PIPELINE_STATUS_EXTENSION,
          "pipelineStatus",
          JsonUtils.pojoToJson(pipelineStatus));
    }
    return pipeline.withPipelineStatus(pipelineStatus);
  }

  public Pipeline deletePipelineStatus(String fqn, Long timestamp) {
    // Validate the request content
    Pipeline pipeline = findByName(fqn, NON_DELETED);
    pipeline.setService(getContainer(pipeline.getId()));
    PipelineStatus storedPipelineStatus =
        JsonUtils.readValue(
            getExtensionAtTimestamp(fqn, PIPELINE_STATUS_EXTENSION, timestamp),
            PipelineStatus.class);
    if (storedPipelineStatus != null) {
      deleteExtensionAtTimestamp(fqn, PIPELINE_STATUS_EXTENSION, timestamp);
      pipeline.setPipelineStatus(storedPipelineStatus);
      return pipeline;
    }
    throw new EntityNotFoundException(
        String.format(
            "Failed to find pipeline status for %s at %s", pipeline.getName(), timestamp));
  }

  public ResultList<PipelineStatus> getPipelineStatuses(String fqn, Long starTs, Long endTs) {
    List<PipelineStatus> pipelineStatuses;
    pipelineStatuses =
        JsonUtils.readObjects(
            getResultsFromAndToTimestamps(fqn, PIPELINE_STATUS_EXTENSION, starTs, endTs),
            PipelineStatus.class);
    return new ResultList<>(
        pipelineStatuses, starTs.toString(), endTs.toString(), pipelineStatuses.size());
  }

  // Validate if a given task exists in the pipeline
  private void validateTask(Pipeline pipeline, String taskName) {
    boolean validTask =
        pipeline.getTasks().stream().anyMatch(task -> task.getName().equals(taskName));
    if (!validTask) {
      throw new IllegalArgumentException("Invalid task name " + taskName);
    }
  }

  @Override
  public void restorePatchAttributes(Pipeline original, Pipeline updated) {
    // Patch can't make changes to following fields. Ignore the changes
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  public void prepare(Pipeline pipeline, boolean update) {
    populateService(pipeline);
  }

  @Override
  public void storeEntity(Pipeline pipeline, boolean update) {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference service = pipeline.getService();
    pipeline.withService(null);

    // Don't store column tags as JSON but build it on the fly based on relationships
    List<Task> taskWithTags = pipeline.getTasks();
    pipeline.setTasks(cloneWithoutTags(taskWithTags));
    store(pipeline, update);
    pipeline.withService(service).withTasks(taskWithTags);
  }

  @Override
  public void storeRelationships(Pipeline pipeline) {
    EntityReference service = pipeline.getService();
    addRelationship(
        service.getId(),
        pipeline.getId(),
        service.getType(),
        Entity.PIPELINE,
        Relationship.CONTAINS);
  }

  @Override
  public void applyTags(Pipeline pipeline) {
    // Add table level tags by adding tag to table relationship
    super.applyTags(pipeline);
    applyTaskTags(pipeline.getTasks()); // TODO need cleanup
  }

  @Override
  public EntityInterface getParentEntity(Pipeline entity, String fields) {
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  @Override
  public void validateTags(Pipeline entity) {
    super.validateTags(entity);
    for (Task task : listOrEmpty(entity.getTasks())) {
      validateTags(task.getTags());
      task.setTags(addDerivedTags(task.getTags()));
      checkMutuallyExclusive(task.getTags());
    }
  }

  private void applyTaskTags(List<Task> tasks) {
    for (Task task : listOrEmpty(tasks)) {
      applyTags(task.getTags(), task.getFullyQualifiedName());
    }
  }

  private void getTaskTags(boolean setTags, List<Task> tasks) {
    for (Task t : listOrEmpty(tasks)) {
      if (t.getTags() == null) {
        t.setTags(setTags ? getTags(t.getFullyQualifiedName()) : t.getTags());
      }
    }
  }

  private void setTaskFQN(String parentFQN, List<Task> tasks) {
    if (tasks != null) {
      tasks.forEach(
          t -> {
            String taskFqn = FullyQualifiedName.add(parentFQN, t.getName());
            t.setFullyQualifiedName(taskFqn);
          });
    }
  }

  @Override
  public EntityUpdater getUpdater(Pipeline original, Pipeline updated, Operation operation) {
    return new PipelineUpdater(original, updated, operation);
  }

  @Override
  public List<TagLabel> getAllTags(EntityInterface entity) {
    List<TagLabel> allTags = new ArrayList<>();
    Pipeline pipeline = (Pipeline) entity;
    EntityUtil.mergeTags(allTags, pipeline.getTags());
    for (Task task : listOrEmpty(pipeline.getTasks())) {
      EntityUtil.mergeTags(allTags, task.getTags());
    }
    return allTags;
  }

  private void populateService(Pipeline pipeline) {
    PipelineService service = Entity.getEntity(pipeline.getService(), "", Include.NON_DELETED);
    pipeline.setService(service.getEntityReference());
    pipeline.setServiceType(service.getServiceType());
  }

  private List<Task> cloneWithoutTags(List<Task> tasks) {
    if (nullOrEmpty(tasks)) {
      return tasks;
    }
    List<Task> copy = new ArrayList<>();
    tasks.forEach(t -> copy.add(cloneWithoutTags(t)));
    return copy;
  }

  private Task cloneWithoutTags(Task task) {
    return new Task()
        .withDescription(task.getDescription())
        .withName(task.getName())
        .withDisplayName(task.getDisplayName())
        .withFullyQualifiedName(task.getFullyQualifiedName())
        .withSourceUrl(task.getSourceUrl())
        .withTaskType(task.getTaskType())
        .withDownstreamTasks(task.getDownstreamTasks())
        .withTaskSQL(task.getTaskSQL())
        .withStartDate(task.getStartDate())
        .withEndDate(task.getEndDate());
  }

  /** Handles entity updated from PUT and POST operation. */
  public class PipelineUpdater extends EntityUpdater {
    public PipelineUpdater(Pipeline original, Pipeline updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate() {
      updateTasks(original, updated);
      recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl());
      recordChange("concurrency", original.getConcurrency(), updated.getConcurrency());
      recordChange(
          "pipelineLocation", original.getPipelineLocation(), updated.getPipelineLocation());
      recordChange("sourceHash", original.getSourceHash(), updated.getSourceHash());
    }

    private void updateTasks(Pipeline original, Pipeline updated) {
      // While the Airflow lineage only gets executed for one Task at a time, we will consider the
      // client Task information as the source of truth. This means that at each update, we will
      // expect to receive all the tasks known until that point.

      // The lineage backend will take care of controlling new & deleted tasks, while passing to the
      // API the full list of Tasks to consider for a given Pipeline. Having a single point of
      // control
      // of the Tasks and their status, simplifies the logic on how to add/delete tasks.

      // The API will only take care of marking tasks as added/updated/deleted based on the original
      // and incoming changes.

      List<Task> origTasks = listOrEmpty(original.getTasks());
      List<Task> updatedTasks = listOrEmpty(updated.getTasks());

      boolean newTasks = false;
      // Update the task descriptions
      for (Task updatedTask : updatedTasks) {
        Task storedTask =
            origTasks.stream().filter(c -> taskMatch.test(c, updatedTask)).findAny().orElse(null);
        if (storedTask == null) { // New task added
          newTasks = true;
          continue;
        }
        updateTaskDescription(storedTask, updatedTask);
        updateTags(
            storedTask.getFullyQualifiedName(),
            EntityUtil.getFieldName(TASKS_FIELD, updatedTask.getName(), FIELD_TAGS),
            storedTask.getTags(),
            updatedTask.getTags());
      }

      boolean removedTasks = updatedTasks.size() < origTasks.size();

      if (newTasks || removedTasks) {
        List<Task> added = new ArrayList<>();
        List<Task> deleted = new ArrayList<>();
        recordListChange(TASKS_FIELD, origTasks, updatedTasks, added, deleted, taskMatch);
        applyTaskTags(added);
        deleted.forEach(
            d -> daoCollection.tagUsageDAO().deleteTagsByTarget(d.getFullyQualifiedName()));
      }
    }

    private void updateTaskDescription(Task origTask, Task updatedTask) {
      if (operation.isPut() && !nullOrEmpty(origTask.getDescription()) && updatedByBot()) {
        // Revert the non-empty task description if being updated by a bot
        updatedTask.setDescription(origTask.getDescription());
        return;
      }
      // Don't record a change if descriptions are the same
      if (origTask != null
          && ((origTask.getDescription() != null
                  && !origTask.getDescription().equals(updatedTask.getDescription()))
              || updatedTask.getDescription() != null)) {
        recordChange(
            "tasks." + origTask.getName() + ".description",
            origTask.getDescription(),
            updatedTask.getDescription());
      }
    }
  }

  public static Task findTask(List<Task> tasks, String taskName) {
    return tasks.stream()
        .filter(c -> c.getName().equals(taskName))
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    CatalogExceptionMessage.invalidFieldName("task", taskName)));
  }
}
