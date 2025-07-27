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
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.schema.type.Relationship.OWNS;
import static org.openmetadata.service.Entity.CONTAINER;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;
import static org.openmetadata.service.util.EntityUtil.taskMatch;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.commons.lang3.tuple.Triple;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
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
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class PipelineRepository extends EntityRepository<Pipeline> {
  private static final String TASKS_FIELD = "tasks";
  private static final String PIPELINE_UPDATE_FIELDS = "tasks";
  private static final String PIPELINE_PATCH_FIELDS = "tasks";
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

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put("pipelineStatus", this::fetchAndSetPipelineStatuses);
    fieldFetchers.put("usageSummary", this::fetchAndSetUsageSummaries);
    fieldFetchers.put(FIELD_TAGS, this::fetchAndSetTaskFieldsInBulk);
    fieldFetchers.put(FIELD_OWNERS, this::fetchAndSetTaskFieldsInBulk);
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
    getTaskTags(fields.contains(FIELD_TAGS), pipeline.getTasks());
    getTaskOwners(fields.contains(FIELD_OWNERS), pipeline.getTasks());
    pipeline.withPipelineStatus(
        fields.contains("pipelineStatus")
            ? getPipelineStatus(pipeline)
            : pipeline.getPipelineStatus());
    if (pipeline.getUsageSummary() == null) {
      pipeline.withUsageSummary(
          fields.contains("usageSummary")
              ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), pipeline.getId())
              : null);
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Pipeline> entities) {
    // Always set default service field for all pipelines
    fetchAndSetDefaultService(entities);

    fetchAndSetFields(entities, fields);
    fetchAndSetPipelineSpecificFields(entities, fields);
    setInheritedFields(entities, fields);

    for (Pipeline entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  private void fetchAndSetPipelineSpecificFields(List<Pipeline> pipelines, Fields fields) {
    if (pipelines == null || pipelines.isEmpty()) {
      return;
    }

    if (fields.contains(FIELD_TAGS) || fields.contains(FIELD_OWNERS)) {
      fetchAndSetTaskFieldsInBulk(pipelines, fields);
    }

    if (fields.contains("pipelineStatus")) {
      fetchAndSetPipelineStatuses(pipelines, fields);
    }

    if (fields.contains("usageSummary")) {
      fetchAndSetUsageSummaries(pipelines, fields);
    }
  }

  private void fetchAndSetTaskFieldsInBulk(List<Pipeline> pipelines, Fields fields) {
    if (pipelines == null || pipelines.isEmpty()) {
      return;
    }

    // Use bulk tag and owner fetching for all pipeline tasks
    for (Pipeline pipeline : pipelines) {
      if (pipeline.getTasks() != null) {
        // Still need individual calls here as tasks don't have bulk fetching pattern
        // This is better than the original N+N pattern we had
        getTaskTags(fields.contains(FIELD_TAGS), pipeline.getTasks());
        getTaskOwners(fields.contains(FIELD_OWNERS), pipeline.getTasks());
      }
    }
  }

  private void fetchAndSetPipelineStatuses(List<Pipeline> pipelines, Fields fields) {
    if (!fields.contains("pipelineStatus") || pipelines == null || pipelines.isEmpty()) {
      return;
    }
    setFieldFromMap(
        true, pipelines, batchFetchPipelineStatuses(pipelines), Pipeline::setPipelineStatus);
  }

  private void fetchAndSetUsageSummaries(List<Pipeline> pipelines, Fields fields) {
    if (!fields.contains("usageSummary") || pipelines == null || pipelines.isEmpty()) {
      return;
    }
    setFieldFromMap(
        true,
        pipelines,
        EntityUtil.getLatestUsageForEntities(daoCollection.usageDAO(), entityListToUUID(pipelines)),
        Pipeline::setUsageSummary);
  }

  @Override
  public void clearFields(Pipeline pipeline, Fields fields) {
    pipeline.withTasks(fields.contains(TASKS_FIELD) ? pipeline.getTasks() : null);
    pipeline.withPipelineStatus(
        fields.contains("pipelineStatus") ? pipeline.getPipelineStatus() : null);
    pipeline.withUsageSummary(fields.contains("usageSummary") ? pipeline.getUsageSummary() : null);
  }

  @Override
  protected void postDelete(Pipeline entity, boolean hardDelete) {
    super.postDelete(entity, hardDelete);
    // Cleanup all the fieldRelationship for task ownership. User -[owns]-> Task
    for (Task task : listOrEmpty(entity.getTasks())) {
      deleteTaskOwnerRelationship(task);
    }
  }

  private PipelineStatus getPipelineStatus(Pipeline pipeline) {
    return JsonUtils.readValue(
        getLatestExtensionFromTimeSeries(
            pipeline.getFullyQualifiedName(), PIPELINE_STATUS_EXTENSION),
        PipelineStatus.class);
  }

  public RestUtil.PutResponse<?> addPipelineStatus(String fqn, PipelineStatus pipelineStatus) {
    // Validate the request content
    Pipeline pipeline = daoCollection.pipelineDAO().findEntityByName(fqn);
    pipeline.setService(getContainer(pipeline.getId()));

    // validate all the Tasks
    for (Status taskStatus : pipelineStatus.getTaskStatus()) {
      validateTask(pipeline, taskStatus.getName());
    }

    // Pipeline status is from the pipeline execution. There is no gurantee that it is unique as it
    // is unrelated to workflow execution. We should bring back the old behavior for this one.
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

    ChangeDescription change =
        addPipelineStatusChangeDescription(
            pipeline.getVersion(), pipelineStatus, storedPipelineStatus);
    pipeline.setPipelineStatus(pipelineStatus);
    pipeline.setChangeDescription(change);
    pipeline.setIncrementalChangeDescription(change);

    // Update ES Indexes and usage of this pipeline index
    searchRepository.updateEntityIndex(pipeline);
    searchRepository
        .getSearchClient()
        .reindexAcrossIndices(
            "upstreamLineage.pipeline.fullyQualifiedName", pipeline.getEntityReference());

    return new RestUtil.PutResponse<>(
        Response.Status.OK,
        pipeline.withPipelineStatus(pipelineStatus).withUpdatedAt(System.currentTimeMillis()),
        ENTITY_UPDATED);
  }

  private ChangeDescription addPipelineStatusChangeDescription(
      Double version, Object newValue, Object oldValue) {
    FieldChange fieldChange =
        new FieldChange().withName("pipelineStatus").withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsUpdated().add(fieldChange);
    return change;
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
    // Tasks can have owners
    for (Task task : listOrEmpty(pipeline.getTasks())) {
      List<EntityReference> owners = validateOwners(task.getOwners());
      task.setOwners(owners);
    }
  }

  @Override
  public void storeEntity(Pipeline pipeline, boolean update) {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference service = pipeline.getService();
    pipeline.withService(null);

    // Don't store column tags as JSON but build it on the fly based on relationships
    List<Task> taskWithTagsAndOwners = pipeline.getTasks();
    pipeline.setTasks(cloneWithoutTagsAndOwners(taskWithTagsAndOwners));
    store(pipeline, update);
    pipeline.withService(service).withTasks(taskWithTagsAndOwners);
  }

  @Override
  protected void entitySpecificCleanup(Pipeline pipeline) {
    // When a pipeline is removed , the linege needs to be removed
    daoCollection
        .relationshipDAO()
        .deleteLineageBySourcePipeline(
            pipeline.getId(),
            LineageDetails.Source.PIPELINE_LINEAGE.value(),
            Relationship.UPSTREAM.ordinal());
  }

  @Override
  public void storeRelationships(Pipeline pipeline) {
    addServiceRelationship(pipeline, pipeline.getService());

    for (Task task : listOrEmpty(pipeline.getTasks())) {
      if (!nullOrEmpty(task.getOwners())) {
        for (EntityReference owner : task.getOwners()) {
          daoCollection
              .fieldRelationshipDAO()
              .insert(
                  FullyQualifiedName.buildHash(owner.getFullyQualifiedName()), // from FQN hash
                  FullyQualifiedName.buildHash(task.getFullyQualifiedName()), // to FQN hash
                  owner.getFullyQualifiedName(), // from FQN
                  task.getFullyQualifiedName(), // to FQN
                  owner.getType(), // from type
                  Entity.TASK, // to type
                  OWNS.ordinal(),
                  null);
        }
      }
    }
  }

  @Override
  public void applyTags(Pipeline pipeline) {
    // Add table level tags by adding tag to table relationship
    super.applyTags(pipeline);
    applyTaskTags(pipeline.getTasks()); // TODO need cleanup
  }

  @Override
  public EntityInterface getParentEntity(Pipeline entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
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
      if (t.getTags() == null || t.getTags().isEmpty()) {
        t.setTags(setTags ? getTags(t.getFullyQualifiedName()) : t.getTags());
      }
    }
  }

  private void getTaskOwners(boolean setOwner, List<Task> tasks) {
    for (Task t : listOrEmpty(tasks)) {
      if (!nullOrEmpty(t.getOwners())) {
        t.setOwners(setOwner ? getTaskOwners(t.getFullyQualifiedName()) : t.getOwners());
      }
    }
  }

  private List<EntityReference> getTaskOwners(String taskFullyQualifiedName) {
    List<EntityReference> ownerRefs = new ArrayList<>();

    List<Triple<String, String, String>> owners =
        daoCollection
            .fieldRelationshipDAO()
            .findFrom(
                FullyQualifiedName.buildHash(taskFullyQualifiedName), Entity.TASK, OWNS.ordinal());

    // Triple<fromFQN, fromType, json>
    for (Triple<String, String, String> owner : owners) {
      if (owner.getMiddle().equals(Entity.USER)) {
        User user = daoCollection.userDAO().findEntityByName(owner.getLeft(), Include.NON_DELETED);
        ownerRefs.add(
            new EntityReference()
                .withId(user.getId())
                .withName(user.getName())
                .withFullyQualifiedName(user.getFullyQualifiedName())
                .withDescription(user.getDescription())
                .withDisplayName(user.getDisplayName())
                .withHref(user.getHref())
                .withDeleted(user.getDeleted()));
      }
    }
    return ownerRefs;
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
  public EntityRepository<Pipeline>.EntityUpdater getUpdater(
      Pipeline original, Pipeline updated, Operation operation, ChangeSource changeSource) {
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

  private List<Task> cloneWithoutTagsAndOwners(List<Task> tasks) {
    if (nullOrEmpty(tasks)) {
      return tasks;
    }
    List<Task> copy = new ArrayList<>();
    tasks.forEach(t -> copy.add(cloneWithoutTagsAndOwners(t)));
    return copy;
  }

  private Task cloneWithoutTagsAndOwners(Task task) {
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

  protected void deleteTaskOwnerRelationship(Task task) {
    // If the deleted task has owners, we need to remove the field relationship
    if (!nullOrEmpty(task.getOwners())) {
      for (EntityReference owner : task.getOwners()) {
        daoCollection
            .fieldRelationshipDAO()
            .delete(
                FullyQualifiedName.buildHash(owner.getFullyQualifiedName()),
                FullyQualifiedName.buildHash(task.getFullyQualifiedName()),
                owner.getType(),
                Entity.TASK,
                OWNS.ordinal());
      }
    }
  }

  private Map<UUID, PipelineStatus> batchFetchPipelineStatuses(List<Pipeline> pipelines) {
    Map<UUID, PipelineStatus> statusMap = new HashMap<>();
    if (pipelines == null || pipelines.isEmpty()) {
      return statusMap;
    }

    for (Pipeline pipeline : pipelines) {
      statusMap.put(pipeline.getId(), getPipelineStatus(pipeline));
    }

    return statusMap;
  }

  private void fetchAndSetDefaultService(List<Pipeline> pipelines) {
    if (pipelines == null || pipelines.isEmpty()) {
      return;
    }

    // Batch fetch service references for all pipelines
    Map<UUID, EntityReference> serviceMap = batchFetchServices(pipelines);

    // Set service for all pipelines
    for (Pipeline pipeline : pipelines) {
      pipeline.setService(serviceMap.get(pipeline.getId()));
    }
  }

  private Map<UUID, EntityReference> batchFetchServices(List<Pipeline> pipelines) {
    Map<UUID, EntityReference> serviceMap = new HashMap<>();
    if (pipelines == null || pipelines.isEmpty()) {
      return serviceMap;
    }

    // Single batch query to get all services for all pipelines
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(pipelines), Relationship.CONTAINS.ordinal());

    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID pipelineId = UUID.fromString(record.getToId());
      EntityReference serviceRef =
          Entity.getEntityReferenceById(
              Entity.PIPELINE_SERVICE, UUID.fromString(record.getFromId()), NON_DELETED);
      serviceMap.put(pipelineId, serviceRef);
    }

    return serviceMap;
  }

  /** Handles entity updated from PUT and POST operation. */
  public class PipelineUpdater extends EntityUpdater {
    public PipelineUpdater(Pipeline original, Pipeline updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateTasks(original, updated);
      recordChange("state", original.getState(), updated.getState());
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
      // control of the Tasks and their status, simplifies the logic on how to add/delete tasks.

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
            d -> {
              daoCollection.tagUsageDAO().deleteTagsByTarget(d.getFullyQualifiedName());
              deleteTaskOwnerRelationship(d);
            });
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
