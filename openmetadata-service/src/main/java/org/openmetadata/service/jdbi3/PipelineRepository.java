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
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Triple;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.PipelineExecutionTrend;
import org.openmetadata.schema.type.PipelineExecutionTrendList;
import org.openmetadata.schema.type.PipelineMetrics;
import org.openmetadata.schema.type.PipelineObservabilityResponse;
import org.openmetadata.schema.type.PipelineRuntimeTrend;
import org.openmetadata.schema.type.PipelineRuntimeTrendList;
import org.openmetadata.schema.type.PipelineSummary;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.ServiceBreakdown;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.TableObservabilityData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.pipelines.PipelineResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
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

    // First, if tags are requested, fetch pipeline-level tags (important for search indexing)
    if (fields.contains(FIELD_TAGS)) {
      List<String> entityFQNs = pipelines.stream().map(Pipeline::getFullyQualifiedName).toList();
      Map<String, List<TagLabel>> tagsMap = batchFetchTags(entityFQNs);
      for (Pipeline pipeline : pipelines) {
        pipeline.setTags(
            addDerivedTags(
                tagsMap.getOrDefault(pipeline.getFullyQualifiedName(), Collections.emptyList())));
      }
    }

    // Then, if tasks field is requested, also handle task-level tags and owners
    if (fields.contains("tasks")) {
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

    // Store PROV-O execution details in RDF
    if (RdfUpdater.isEnabled()) {
      storePipelineExecutionInRdf(pipeline, pipelineStatus);
    }

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

  private void storePipelineExecutionInRdf(Pipeline pipeline, PipelineStatus pipelineStatus) {
    try {
      RdfRepository rdfRepository = RdfRepository.getInstance();

      // Create unique execution URI
      String executionUri =
          String.format(
              "https://open-metadata.org/execution/%s/%d",
              pipeline.getId(), pipelineStatus.getTimestamp());
      String pipelineUri = "https://open-metadata.org/entity/pipeline/" + pipeline.getId();

      StringBuilder sparql = new StringBuilder();
      sparql.append("PREFIX prov: <http://www.w3.org/ns/prov#>\n");
      sparql.append("PREFIX om: <https://open-metadata.org/ontology/>\n");
      sparql.append("PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\n");
      sparql.append("INSERT DATA {\n");

      // Basic execution info
      sparql.append(
          String.format("  <%s> a om:PipelineExecution, prov:Activity ;\n", executionUri));
      sparql.append(String.format("    prov:wasAssociatedWith <%s> ;\n", pipelineUri));
      sparql.append(
          String.format(
              "    prov:startedAtTime \"%s\"^^xsd:dateTime ;\n",
              formatTimestamp(pipelineStatus.getTimestamp())));

      // Add end time if available
      if (pipelineStatus.getEndTime() != null) {
        sparql.append(
            String.format(
                "    prov:endedAtTime \"%s\"^^xsd:dateTime ;\n",
                formatTimestamp(pipelineStatus.getEndTime())));
      }

      sparql.append(
          String.format("    om:executionStatus \"%s\" ;\n", pipelineStatus.getExecutionStatus()));

      // Add execution ID if available
      if (pipelineStatus.getExecutionId() != null) {
        sparql.append(
            String.format("    om:executionId \"%s\" ;\n", pipelineStatus.getExecutionId()));
      }

      // Add executed by if available
      if (pipelineStatus.getExecutedBy() != null) {
        String agentUri =
            "https://open-metadata.org/entity/"
                + pipelineStatus.getExecutedBy().getType()
                + "/"
                + pipelineStatus.getExecutedBy().getId();
        sparql.append(String.format("    prov:wasAssociatedWith <%s> ;\n", agentUri));
      }

      // Add inputs (prov:used)
      if (pipelineStatus.getInputs() != null) {
        for (var input : pipelineStatus.getInputs()) {
          if (input.getDatasetFQN() != null) {
            try {
              EntityReference dataset =
                  Entity.getEntityReferenceByName(
                      Entity.TABLE, input.getDatasetFQN(), Include.NON_DELETED);
              String datasetUri = "https://open-metadata.org/entity/table/" + dataset.getId();
              sparql.append(String.format("    prov:used <%s> ;\n", datasetUri));

              if (input.getRowCount() != null) {
                sparql.append(
                    String.format(
                        "    om:inputRowCount_%s %d ;\n", dataset.getId(), input.getRowCount()));
              }
            } catch (Exception e) {
              // Dataset not found, skip
            }
          }
        }
      }

      // Add outputs (prov:generated)
      if (pipelineStatus.getOutputs() != null) {
        for (var output : pipelineStatus.getOutputs()) {
          if (output.getDatasetFQN() != null) {
            try {
              EntityReference dataset =
                  Entity.getEntityReferenceByName(
                      Entity.TABLE, output.getDatasetFQN(), Include.NON_DELETED);
              String datasetUri = "https://open-metadata.org/entity/table/" + dataset.getId();
              sparql.append(String.format("    prov:generated <%s> ;\n", datasetUri));

              if (output.getRowCount() != null) {
                sparql.append(
                    String.format(
                        "    om:outputRowCount_%s %d ;\n", dataset.getId(), output.getRowCount()));
              }
            } catch (Exception e) {
              // Dataset not found, skip
            }
          }
        }
      }

      // Add metrics
      if (pipelineStatus.getMetrics() != null) {
        if (pipelineStatus.getMetrics().getTotalRowsProcessed() != null) {
          sparql.append(
              String.format(
                  "    om:rowsProcessed %d ;\n",
                  pipelineStatus.getMetrics().getTotalRowsProcessed()));
        }
        if (pipelineStatus.getMetrics().getTotalBytesProcessed() != null) {
          sparql.append(
              String.format(
                  "    om:bytesProcessed %d ;\n",
                  pipelineStatus.getMetrics().getTotalBytesProcessed()));
        }
      }

      // Add parameters as JSON
      if (pipelineStatus.getParameters() != null) {
        String paramsJson =
            JsonUtils.pojoToJson(pipelineStatus.getParameters()).replace("\"", "\\\"");
        sparql.append(String.format("    om:parameters \"%s\" ;\n", paramsJson));
      }

      // Close the execution entity
      sparql.setLength(sparql.length() - 2); // Remove last semicolon and newline
      sparql.append(" .\n");

      // Add task executions
      if (pipelineStatus.getTaskStatus() != null) {
        for (Status taskStatus : pipelineStatus.getTaskStatus()) {
          String taskUri =
              executionUri + "/task/" + taskStatus.getName().replaceAll("[^a-zA-Z0-9]", "_");
          sparql.append(String.format("\n  <%s> a om:Transformation, prov:Activity ;\n", taskUri));
          sparql.append(String.format("    prov:wasInformedBy <%s> ;\n", executionUri));
          sparql.append(String.format("    om:taskName \"%s\" ;\n", taskStatus.getName()));
          sparql.append(
              String.format("    om:executionStatus \"%s\" ;\n", taskStatus.getExecutionStatus()));

          if (taskStatus.getStartTime() != null) {
            sparql.append(
                String.format(
                    "    prov:startedAtTime \"%s\"^^xsd:dateTime ;\n",
                    formatTimestamp(taskStatus.getStartTime())));
          }

          if (taskStatus.getEndTime() != null) {
            sparql.append(
                String.format(
                    "    prov:endedAtTime \"%s\"^^xsd:dateTime ;\n",
                    formatTimestamp(taskStatus.getEndTime())));
          }

          if (taskStatus.getTransformationType() != null) {
            sparql.append(
                String.format(
                    "    om:transformationType \"%s\" ;\n", taskStatus.getTransformationType()));
          }

          if (taskStatus.getTransformationLogic() != null) {
            String logic = taskStatus.getTransformationLogic().replace("\"", "\\\"");
            sparql.append(String.format("    om:transformationLogic \"%s\" ;\n", logic));
          }

          sparql.setLength(sparql.length() - 2);
          sparql.append(" .\n");
        }
      }

      sparql.append("}");

      // Execute the SPARQL update
      rdfRepository.executeSparqlUpdate(sparql.toString());

    } catch (Exception e) {
      LOG.error("Failed to store pipeline execution in RDF", e);
    }
  }

  /**
   * Get pipeline observability data for all tables associated with a pipeline.
   *
   * @param pipelineId the pipeline ID
   * @return PipelineObservabilityResponse containing observability data grouped by tables
   */
  public PipelineObservabilityResponse getPipelineObservability(UUID pipelineId) {
    // Get the pipeline entity to retrieve its FQN
    Pipeline pipeline = get(null, pipelineId, getFields("*"));
    if (pipeline == null) {
      throw new EntityNotFoundException(String.format("Pipeline with id %s not found", pipelineId));
    }

    String pipelineFqn = pipeline.getFullyQualifiedName();

    // Query entity_extension table for pipeline observability data
    // The extension key pattern is: table.pipelineObservability.{pipelineFqn}
    String extensionKey = "table.pipelineObservability." + pipelineFqn;

    List<TableObservabilityData> tableObservabilityList = new ArrayList<>();

    try {
      LOG.info(
          "Retrieving pipeline observability data for pipeline: {} ({})", pipelineId, pipelineFqn);

      // Query entity_extension table for all entries that match the extension key
      List<CollectionDAO.ExtensionWithIdAndSchemaObject> records =
          daoCollection.entityExtensionDAO().getExtensionsByPrefixBatch(extensionKey);

      // Group records by table ID
      Map<UUID, List<CollectionDAO.ExtensionWithIdAndSchemaObject>> recordsByTableId =
          new HashMap<>();
      for (CollectionDAO.ExtensionWithIdAndSchemaObject record : records) {
        UUID tableId = UUID.fromString(record.getId());
        recordsByTableId.computeIfAbsent(tableId, k -> new ArrayList<>()).add(record);
      }

      // Process each table's pipeline observability data
      for (Map.Entry<UUID, List<CollectionDAO.ExtensionWithIdAndSchemaObject>> entry :
          recordsByTableId.entrySet()) {
        UUID tableId = entry.getKey();
        List<CollectionDAO.ExtensionWithIdAndSchemaObject> tableRecords = entry.getValue();

        try {
          // Get table reference for FQN
          EntityReference tableRef =
              Entity.getEntityReferenceById(Entity.TABLE, tableId, Include.NON_DELETED);

          // Parse observability data for this table
          List<org.openmetadata.schema.type.PipelineObservability> observabilityData =
              new ArrayList<>();
          for (CollectionDAO.ExtensionWithIdAndSchemaObject record : tableRecords) {
            if (record.getExtension().equals(extensionKey)) {
              org.openmetadata.schema.type.PipelineObservability observability =
                  JsonUtils.readValue(
                      record.getJson(), org.openmetadata.schema.type.PipelineObservability.class);
              observabilityData.add(observability);
            }
          }

          // Only add tables that have observability data for this specific pipeline
          if (!observabilityData.isEmpty()) {
            TableObservabilityData tableObsData =
                new TableObservabilityData()
                    .withTableId(tableId)
                    .withTableFqn(tableRef.getFullyQualifiedName())
                    .withObservabilityData(observabilityData);

            tableObservabilityList.add(tableObsData);
          }

        } catch (EntityNotFoundException e) {
          LOG.warn("Table with ID {} not found, skipping observability data", tableId);
        } catch (Exception e) {
          LOG.error(
              "Failed to process observability data for table {}: {}", tableId, e.getMessage());
        }
      }

      LOG.info(
          "Retrieved pipeline observability data for {} tables", tableObservabilityList.size());

    } catch (Exception e) {
      LOG.error(
          "Failed to retrieve pipeline observability data for pipeline {}: {}",
          pipelineId,
          e.getMessage());
      throw new RuntimeException("Failed to retrieve pipeline observability data", e);
    }

    return new PipelineObservabilityResponse()
        .withPipelineId(pipelineId)
        .withPipelineFqn(pipelineFqn)
        .withTableObservabilityData(tableObservabilityList);
  }

  private String formatTimestamp(Long timestamp) {
    if (timestamp == null) return "";
    return new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'")
        .format(new java.util.Date(timestamp));
  }

  public ResultList<PipelineSummary> listPipelineSummaries(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Fields fields,
      ListFilter filter,
      int limit,
      String before,
      String after) {

    // Create combined fields set
    Set<String> requiredFieldSet = new HashSet<>(fields.getFieldList());
    requiredFieldSet.addAll(Set.of("service", "serviceType", "scheduleInterval", "pipelineStatus"));
    Fields requiredFields = new Fields(requiredFieldSet);

    // Use correct base method based on pagination direction
    ResultList<Pipeline> pipelines;
    if (before != null) {
      pipelines = listBefore(uriInfo, requiredFields, filter, limit, before);
    } else {
      pipelines = listAfter(uriInfo, requiredFields, filter, limit, after);
    }

    List<PipelineSummary> summaries = new ArrayList<>();
    for (Pipeline pipeline : pipelines.getData()) {
      try {
        PipelineSummary summary = buildPipelineSummary(pipeline);
        summaries.add(summary);
      } catch (Exception e) {
        LOG.error(
            "Failed to build summary for pipeline {}: {}",
            pipeline.getFullyQualifiedName(),
            e.getMessage());
        summaries.add(buildFallbackSummary(pipeline));
      }
    }

    // Extract pagination info correctly
    String beforeCursor = pipelines.getPaging() != null ? pipelines.getPaging().getBefore() : null;
    String afterCursor = pipelines.getPaging() != null ? pipelines.getPaging().getAfter() : null;
    Integer total = pipelines.getPaging() != null ? pipelines.getPaging().getTotal() : 0;

    return new ResultList<>(summaries, beforeCursor, afterCursor, total != null ? total : 0);
  }

  private PipelineSummary buildPipelineSummary(Pipeline pipeline) {
    PipelineSummary summary = new PipelineSummary();

    summary.setPipelineId(pipeline.getId());
    summary.setPipelineName(pipeline.getName());
    summary.setPipelineFqn(pipeline.getFullyQualifiedName());
    summary.setServiceType(pipeline.getServiceType());

    if (pipeline.getPipelineStatus() != null) {
      summary.setLastRunTime(pipeline.getPipelineStatus().getTimestamp());
      if (pipeline.getPipelineStatus().getExecutionStatus() != null) {
        String statusString = pipeline.getPipelineStatus().getExecutionStatus().toString();
        summary.setLastRunStatus(PipelineSummary.LastRunStatus.fromValue(statusString));
      }
    }

    summary.setScheduleInterval(pipeline.getScheduleInterval());

    int impactedCount = getImpactedAssetsCount(pipeline.getFullyQualifiedName());
    summary.setImpactedAssetsCount(impactedCount);

    return summary;
  }

  private PipelineSummary buildFallbackSummary(Pipeline pipeline) {
    return new PipelineSummary()
        .withPipelineId(pipeline.getId())
        .withPipelineName(pipeline.getName())
        .withPipelineFqn(pipeline.getFullyQualifiedName())
        .withServiceType(pipeline.getServiceType())
        .withLastRunTime(null)
        .withLastRunStatus(null)
        .withScheduleInterval(pipeline.getScheduleInterval())
        .withImpactedAssetsCount(0);
  }

  private int getImpactedAssetsCount(String pipelineFqn) {
    if (nullOrEmpty(pipelineFqn)) {
      return 0;
    }

    try {
      String extensionKey = "table.pipelineObservability." + pipelineFqn;
      List<CollectionDAO.ExtensionWithIdAndSchemaObject> records =
          daoCollection.entityExtensionDAO().getExtensionsByPrefixBatch(extensionKey);

      // Count unique table IDs
      Set<String> uniqueTableIds = new HashSet<>();
      for (CollectionDAO.ExtensionWithIdAndSchemaObject record : records) {
        uniqueTableIds.add(record.getId());
      }

      return uniqueTableIds.size();

    } catch (Exception e) {
      LOG.error(
          "Failed to get impacted assets count for pipeline '{}': {}", pipelineFqn, e.getMessage());
      return 0;
    }
  }

  public PipelineMetrics getPipelineMetrics(boolean allowFallback) {
    try {
      return getPipelineMetricsFromES();
    } catch (Exception e) {
      LOG.warn("Failed to get metrics from Elasticsearch: {}", e.getMessage());

      if (allowFallback) {
        try {
          return getPipelineMetricsFromDB();
        } catch (Exception dbException) {
          LOG.error("Database fallback also failed: {}", dbException.getMessage());
          return createEmptyMetrics("Both ES and DB queries failed");
        }
      }

      return createEmptyMetrics("Elasticsearch unavailable");
    }
  }

  private PipelineMetrics getPipelineMetricsFromES() throws IOException {
    try {
      String pipelineIndex = "pipeline_search_index";

      String query =
          "{\n"
              + "  \"size\": 0,\n"
              + "  \"track_total_hits\": true,\n"
              + "  \"aggs\": {\n"
              + "    \"service_count\": {\n"
              + "      \"cardinality\": {\n"
              + "        \"field\": \"service.name.keyword\",\n"
              + "        \"precision_threshold\": 100\n"
              + "      }\n"
              + "    },\n"
              + "    \"state_breakdown\": {\n"
              + "      \"terms\": {\n"
              + "        \"field\": \"state\",\n"
              + "        \"size\": 10,\n"
              + "        \"missing\": \"Unknown\"\n"
              + "      }\n"
              + "    },\n"
              + "    \"status_breakdown\": {\n"
              + "      \"terms\": {\n"
              + "        \"field\": \"pipelineStatus.executionStatus\",\n"
              + "        \"size\": 20,\n"
              + "        \"missing\": \"Never Run\"\n"
              + "      }\n"
              + "    },\n"
              + "    \"service_breakdown\": {\n"
              + "      \"terms\": {\n"
              + "        \"field\": \"service.name.keyword\",\n"
              + "        \"size\": 100,\n"
              + "        \"min_doc_count\": 1\n"
              + "      },\n"
              + "      \"aggs\": {\n"
              + "        \"service_type\": {\n"
              + "          \"terms\": {\n"
              + "            \"field\": \"serviceType\",\n"
              + "            \"size\": 1,\n"
              + "            \"missing\": \"Unknown\"\n"
              + "          }\n"
              + "        }\n"
              + "      }\n"
              + "    }\n"
              + "  }\n"
              + "}";

      AggregationRequest aggregationRequest =
          new AggregationRequest().withIndex(pipelineIndex).withQuery("*").withSize(0);

      Response response =
          Entity.getSearchRepository().getSearchClient().aggregate(aggregationRequest);
      String responseStr = response.getEntity() != null ? response.getEntity().toString() : "{}";

      return parseMetricsFromESResponse(responseStr);

    } catch (Exception e) {
      LOG.error("ES query execution failed: {}", e.getMessage());
      throw new IOException("Failed to execute ES query", e);
    }
  }

  private PipelineMetrics parseMetricsFromESResponse(String response) {
    PipelineMetrics metrics = new PipelineMetrics();
    metrics.setDataAvailable(true);

    try {
      Map<String, Object> responseMap = JsonUtils.readValue(response, Map.class);

      Map<String, Object> hits = (Map<String, Object>) responseMap.get("hits");
      if (hits != null && hits.get("total") != null) {
        Map<String, Object> total = (Map<String, Object>) hits.get("total");
        if (total != null && total.get("value") != null) {
          metrics.setTotalPipelines(((Number) total.get("value")).intValue());
        }
      }

      Map<String, Object> aggregations = (Map<String, Object>) responseMap.get("aggregations");
      if (aggregations != null) {
        parseServiceCount(aggregations, metrics);
        parseStateBreakdown(aggregations, metrics);
        parseStatusBreakdown(aggregations, metrics);
        parseServiceBreakdown(aggregations, metrics);
      }

    } catch (Exception e) {
      LOG.warn("Failed to parse ES response: {}", e.getMessage());
      metrics.setErrorMessage("Failed to parse ES response");
    }

    return metrics;
  }

  private void parseServiceCount(Map<String, Object> aggregations, PipelineMetrics metrics) {
    try {
      Map<String, Object> serviceCount = (Map<String, Object>) aggregations.get("service_count");
      if (serviceCount != null && serviceCount.get("value") != null) {
        metrics.setServiceCount(((Number) serviceCount.get("value")).intValue());
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse service count: {}", e.getMessage());
      metrics.setServiceCount(0);
    }
  }

  private void parseStateBreakdown(Map<String, Object> aggregations, PipelineMetrics metrics) {
    try {
      Map<String, Object> stateBreakdown =
          (Map<String, Object>) aggregations.get("state_breakdown");
      if (stateBreakdown != null && stateBreakdown.get("buckets") != null) {
        List<Map<String, Object>> buckets =
            (List<Map<String, Object>>) stateBreakdown.get("buckets");

        int active = 0, inactive = 0;
        for (Map<String, Object> bucket : buckets) {
          String state = (String) bucket.get("key");
          int count = ((Number) bucket.get("doc_count")).intValue();

          if ("Active".equalsIgnoreCase(state)) {
            active = count;
          } else if ("Inactive".equalsIgnoreCase(state)) {
            inactive = count;
          }
        }

        metrics.setActivePipelines(active);
        metrics.setInactivePipelines(inactive);
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse state breakdown: {}", e.getMessage());
      metrics.setActivePipelines(0);
      metrics.setInactivePipelines(0);
    }
  }

  private void parseStatusBreakdown(Map<String, Object> aggregations, PipelineMetrics metrics) {
    try {
      Map<String, Object> statusBreakdown =
          (Map<String, Object>) aggregations.get("status_breakdown");
      if (statusBreakdown != null && statusBreakdown.get("buckets") != null) {
        List<Map<String, Object>> buckets =
            (List<Map<String, Object>>) statusBreakdown.get("buckets");

        int failed = 0, successful = 0, neverRun = 0;
        for (Map<String, Object> bucket : buckets) {
          String status = (String) bucket.get("key");
          int count = ((Number) bucket.get("doc_count")).intValue();

          if ("Failed".equalsIgnoreCase(status)) {
            failed = count;
          } else if ("Successful".equalsIgnoreCase(status)) {
            successful = count;
          } else if ("Never Run".equalsIgnoreCase(status)) {
            neverRun = count;
          }
        }

        metrics.setFailedPipelines(failed);
        metrics.setSuccessfulPipelines(successful);
        metrics.setPipelinesWithoutStatus(neverRun);
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse status breakdown: {}", e.getMessage());
      metrics.setFailedPipelines(0);
      metrics.setSuccessfulPipelines(0);
      metrics.setPipelinesWithoutStatus(0);
    }
  }

  private void parseServiceBreakdown(Map<String, Object> aggregations, PipelineMetrics metrics) {
    List<ServiceBreakdown> serviceBreakdowns = new ArrayList<>();

    try {
      Map<String, Object> serviceBreakdown =
          (Map<String, Object>) aggregations.get("service_breakdown");
      if (serviceBreakdown != null && serviceBreakdown.get("buckets") != null) {
        List<Map<String, Object>> buckets =
            (List<Map<String, Object>>) serviceBreakdown.get("buckets");

        for (Map<String, Object> bucket : buckets) {
          try {
            ServiceBreakdown breakdown = new ServiceBreakdown();
            breakdown.setServiceName(
                bucket.get("key") != null ? bucket.get("key").toString() : "Unknown");
            breakdown.setCount(
                bucket.get("doc_count") != null
                    ? ((Number) bucket.get("doc_count")).intValue()
                    : 0);

            Map<String, Object> subAggs = (Map<String, Object>) bucket.get("service_type");
            if (subAggs != null && subAggs.get("buckets") != null) {
              List<Map<String, Object>> serviceTypeBuckets =
                  (List<Map<String, Object>>) subAggs.get("buckets");
              if (!serviceTypeBuckets.isEmpty()) {
                breakdown.setServiceType(
                    serviceTypeBuckets.get(0).get("key") != null
                        ? serviceTypeBuckets.get(0).get("key").toString()
                        : null);
              }
            }

            serviceBreakdowns.add(breakdown);
          } catch (Exception e) {
            LOG.warn("Failed to parse service bucket: {}", e.getMessage());
          }
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse service breakdown: {}", e.getMessage());
    }

    metrics.setServiceBreakdown(serviceBreakdowns);
  }

  private PipelineMetrics getPipelineMetricsFromDB() {
    PipelineMetrics metrics = new PipelineMetrics();
    metrics.setDataAvailable(false);

    try {
      ListFilter filter = new ListFilter(Include.NON_DELETED);
      int totalCount = daoCollection.pipelineDAO().listCount(filter);
      metrics.setTotalPipelines(totalCount);

      List<Pipeline> samples = listAfter(null, Fields.EMPTY_FIELDS, filter, 100, null).getData();

      if (!nullOrEmpty(samples)) {
        Set<String> services = new HashSet<>();
        int active = 0, failed = 0, successful = 0;

        for (Pipeline pipeline : samples) {
          if (pipeline.getService() != null) {
            services.add(pipeline.getService().getName());
          }

          if (pipeline.getState() != null && "Active".equals(pipeline.getState().toString())) {
            active++;
          }

          if (pipeline.getPipelineStatus() != null
              && pipeline.getPipelineStatus().getExecutionStatus() != null) {
            String status = pipeline.getPipelineStatus().getExecutionStatus().toString();
            if ("Failed".equals(status)) {
              failed++;
            } else if ("Successful".equals(status)) {
              successful++;
            }
          }
        }

        metrics.setServiceCount(services.size());

        if (samples.size() > 0) {
          double ratio = (double) totalCount / samples.size();
          metrics.setActivePipelines((int) (active * ratio));
          metrics.setFailedPipelines((int) (failed * ratio));
          metrics.setSuccessfulPipelines((int) (successful * ratio));
        }
      }

      metrics.setErrorMessage("Using database fallback - limited metrics available");

    } catch (Exception e) {
      LOG.error("Database fallback failed: {}", e.getMessage());
      metrics.setErrorMessage("Database query failed: " + e.getMessage());
    }

    return metrics;
  }

  private PipelineMetrics createEmptyMetrics(String errorMessage) {
    return new PipelineMetrics()
        .withTotalPipelines(0)
        .withServiceCount(0)
        .withActivePipelines(0)
        .withInactivePipelines(0)
        .withFailedPipelines(0)
        .withSuccessfulPipelines(0)
        .withPipelinesWithoutStatus(0)
        .withServiceBreakdown(new ArrayList<>())
        .withDataAvailable(false)
        .withErrorMessage(errorMessage);
  }

  public PipelineExecutionTrendList getPipelineExecutionTrend(
      Long startTs, Long endTs, UUID pipelineId, String serviceType) {
    try {
      return getPipelineExecutionTrendFromES(startTs, endTs, pipelineId, serviceType);
    } catch (Exception e) {
      LOG.warn("Failed to get execution trend from Elasticsearch: {}", e.getMessage());
      return createEmptyExecutionTrend("Elasticsearch unavailable: " + e.getMessage());
    }
  }

  private PipelineExecutionTrendList getPipelineExecutionTrendFromES(
      Long startTs, Long endTs, UUID pipelineId, String serviceType) throws IOException {
    try {
      String pipelineStatusIndex = "pipeline_status_search_index";

      String pipelineIdFilter = "";
      if (pipelineId != null) {
        pipelineIdFilter =
            """
            ,{
              "term": {
                "pipelineId": "%s"
              }
            }
            """
                .formatted(pipelineId);
      }

      String serviceTypeFilter = "";
      if (serviceType != null && !serviceType.isEmpty()) {
        serviceTypeFilter =
            """
            ,{
              "term": {
                "serviceType": "%s"
              }
            }
            """
                .formatted(serviceType);
      }

      String query =
          """
          {
            "size": 0,
            "track_total_hits": true,
            "query": {
              "bool": {
                "must": [
                  {
                    "range": {
                      "timestamp": {
                        "gte": %d,
                        "lte": %d
                      }
                    }
                  }%s%s
                ]
              }
            },
            "aggs": {
              "execution_by_date": {
                "date_histogram": {
                  "field": "timestamp",
                  "calendar_interval": "day",
                  "min_doc_count": 0,
                  "extended_bounds": {
                    "min": %d,
                    "max": %d
                  }
                },
                "aggs": {
                  "status_breakdown": {
                    "terms": {
                      "field": "executionStatus",
                      "size": 10
                    }
                  }
                }
              }
            }
          }
          """
              .formatted(startTs, endTs, pipelineIdFilter, serviceTypeFilter, startTs, endTs);

      AggregationRequest aggregationRequest =
          new AggregationRequest().withIndex(pipelineStatusIndex).withQuery("*").withSize(0);

      Response response =
          Entity.getSearchRepository().getSearchClient().aggregate(aggregationRequest);
      String responseStr = response.getEntity() != null ? response.getEntity().toString() : "{}";

      return parseExecutionTrendFromESResponse(responseStr, startTs, endTs);

    } catch (Exception e) {
      LOG.error("ES query execution failed: {}", e.getMessage());
      throw new IOException("Failed to execute ES query", e);
    }
  }

  private PipelineExecutionTrendList parseExecutionTrendFromESResponse(
      String response, Long startTs, Long endTs) {
    PipelineExecutionTrendList trendList = new PipelineExecutionTrendList();
    trendList.setDataAvailable(true);
    List<PipelineExecutionTrend> trends = new ArrayList<>();

    int totalSuccess = 0;
    int totalFailed = 0;
    int totalExecutions = 0;

    try {
      Map<String, Object> responseMap = JsonUtils.readValue(response, Map.class);
      Map<String, Object> aggregations = (Map<String, Object>) responseMap.get("aggregations");

      if (aggregations != null) {
        Map<String, Object> executionByDate =
            (Map<String, Object>) aggregations.get("execution_by_date");
        if (executionByDate != null && executionByDate.get("buckets") != null) {
          List<Map<String, Object>> buckets =
              (List<Map<String, Object>>) executionByDate.get("buckets");

          for (Map<String, Object> bucket : buckets) {
            try {
              Long timestamp = ((Number) bucket.get("key")).longValue();
              String dateStr = bucket.get("key_as_string").toString();

              PipelineExecutionTrend trend = new PipelineExecutionTrend();
              trend.setTimestamp(timestamp);
              trend.setDate(dateStr);

              int success = 0, failed = 0, pending = 0, skipped = 0, total = 0;

              Map<String, Object> statusBreakdown =
                  (Map<String, Object>) bucket.get("status_breakdown");
              if (statusBreakdown != null && statusBreakdown.get("buckets") != null) {
                List<Map<String, Object>> statusBuckets =
                    (List<Map<String, Object>>) statusBreakdown.get("buckets");

                for (Map<String, Object> statusBucket : statusBuckets) {
                  String status = (String) statusBucket.get("key");
                  int count = ((Number) statusBucket.get("doc_count")).intValue();

                  if ("Successful".equalsIgnoreCase(status)) {
                    success = count;
                  } else if ("Failed".equalsIgnoreCase(status)) {
                    failed = count;
                  } else if ("Pending".equalsIgnoreCase(status)) {
                    pending = count;
                  } else if ("Skipped".equalsIgnoreCase(status)) {
                    skipped = count;
                  }
                  total += count;
                }
              }

              trend.setSuccessCount(success);
              trend.setFailedCount(failed);
              trend.setPendingCount(pending);
              trend.setSkippedCount(skipped);
              trend.setTotalCount(total);

              totalSuccess += success;
              totalFailed += failed;
              totalExecutions += total;

              trends.add(trend);
            } catch (Exception e) {
              LOG.warn("Failed to parse execution trend bucket: {}", e.getMessage());
            }
          }
        }
      }

      trendList.setData(trends);
      trendList.setTotalSuccessful(totalSuccess);
      trendList.setTotalFailed(totalFailed);
      trendList.setTotalExecutions(totalExecutions);

      java.time.Instant startInstant = java.time.Instant.ofEpochMilli(startTs);
      java.time.Instant endInstant = java.time.Instant.ofEpochMilli(endTs);
      trendList.setStartDate(startInstant.toString());
      trendList.setEndDate(endInstant.toString());

    } catch (Exception e) {
      LOG.warn("Failed to parse ES response: {}", e.getMessage());
      trendList.setErrorMessage("Failed to parse ES response: " + e.getMessage());
    }

    return trendList;
  }

  private PipelineExecutionTrendList createEmptyExecutionTrend(String errorMessage) {
    return new PipelineExecutionTrendList()
        .withData(new ArrayList<>())
        .withDataAvailable(false)
        .withErrorMessage(errorMessage)
        .withTotalSuccessful(0)
        .withTotalFailed(0)
        .withTotalExecutions(0);
  }

  public PipelineRuntimeTrendList getPipelineRuntimeTrend(
      Long startTs, Long endTs, UUID pipelineId, String serviceType) {
    try {
      return getPipelineRuntimeTrendFromES(startTs, endTs, pipelineId, serviceType);
    } catch (Exception e) {
      LOG.warn("Failed to get runtime trend from Elasticsearch: {}", e.getMessage());
      return createEmptyRuntimeTrend("Elasticsearch unavailable: " + e.getMessage());
    }
  }

  private PipelineRuntimeTrendList getPipelineRuntimeTrendFromES(
      Long startTs, Long endTs, UUID pipelineId, String serviceType) throws IOException {
    try {
      String pipelineStatusIndex = "pipeline_status_search_index";

      String pipelineIdFilter = "";
      if (pipelineId != null) {
        pipelineIdFilter =
            """
            ,{
              "term": {
                "pipelineId": "%s"
              }
            }
            """
                .formatted(pipelineId);
      }

      String serviceTypeFilter = "";
      if (serviceType != null && !serviceType.isEmpty()) {
        serviceTypeFilter =
            """
            ,{
              "term": {
                "serviceType": "%s"
              }
            }
            """
                .formatted(serviceType);
      }

      String query =
          """
          {
            "size": 0,
            "track_total_hits": true,
            "query": {
              "bool": {
                "must": [
                  {
                    "range": {
                      "timestamp": {
                        "gte": %d,
                        "lte": %d
                      }
                    }
                  },
                  {
                    "exists": {
                      "field": "endTime"
                    }
                  }%s%s
                ]
              }
            },
            "aggs": {
              "runtime_by_date": {
                "date_histogram": {
                  "field": "timestamp",
                  "calendar_interval": "day",
                  "min_doc_count": 0,
                  "extended_bounds": {
                    "min": %d,
                    "max": %d
                  }
                },
                "aggs": {
                  "max_runtime": {
                    "max": {
                      "script": {
                        "source": "doc.containsKey('endTime') && doc['endTime'].size() > 0 && doc.containsKey('timestamp') && doc['timestamp'].size() > 0 ? Math.max(0, doc['endTime'].value - doc['timestamp'].value) : 0"
                      }
                    }
                  },
                  "min_runtime": {
                    "min": {
                      "script": {
                        "source": "doc.containsKey('endTime') && doc['endTime'].size() > 0 && doc.containsKey('timestamp') && doc['timestamp'].size() > 0 ? Math.max(0, doc['endTime'].value - doc['timestamp'].value) : Long.MAX_VALUE"
                      }
                    }
                  },
                  "avg_runtime": {
                    "avg": {
                      "script": {
                        "source": "doc.containsKey('endTime') && doc['endTime'].size() > 0 && doc.containsKey('timestamp') && doc['timestamp'].size() > 0 ? Math.max(0, doc['endTime'].value - doc['timestamp'].value) : 0"
                      }
                    }
                  }
                }
              }
            }
          }
          """
              .formatted(startTs, endTs, pipelineIdFilter, serviceTypeFilter, startTs, endTs);

      AggregationRequest aggregationRequest =
          new AggregationRequest().withIndex(pipelineStatusIndex).withQuery("*").withSize(0);

      Response response =
          Entity.getSearchRepository().getSearchClient().aggregate(aggregationRequest);
      String responseStr = response.getEntity() != null ? response.getEntity().toString() : "{}";

      return parseRuntimeTrendFromESResponse(responseStr, startTs, endTs);

    } catch (Exception e) {
      LOG.error("ES query execution failed: {}", e.getMessage());
      throw new IOException("Failed to execute ES query", e);
    }
  }

  private PipelineRuntimeTrendList parseRuntimeTrendFromESResponse(
      String response, Long startTs, Long endTs) {
    PipelineRuntimeTrendList trendList = new PipelineRuntimeTrendList();
    trendList.setDataAvailable(true);
    List<PipelineRuntimeTrend> trends = new ArrayList<>();

    try {
      Map<String, Object> responseMap = JsonUtils.readValue(response, Map.class);
      Map<String, Object> aggregations = (Map<String, Object>) responseMap.get("aggregations");

      if (aggregations != null) {
        Map<String, Object> runtimeByDate =
            (Map<String, Object>) aggregations.get("runtime_by_date");
        if (runtimeByDate != null && runtimeByDate.get("buckets") != null) {
          List<Map<String, Object>> buckets =
              (List<Map<String, Object>>) runtimeByDate.get("buckets");

          for (Map<String, Object> bucket : buckets) {
            try {
              Long timestamp = ((Number) bucket.get("key")).longValue();
              String dateStr = bucket.get("key_as_string").toString();

              PipelineRuntimeTrend trend = new PipelineRuntimeTrend();
              trend.setTimestamp(timestamp);
              trend.setDate(dateStr);

              long maxRuntime = 0;
              long minRuntime = 0;
              double avgRuntime = 0.0;
              int totalPipelines = ((Number) bucket.get("doc_count")).intValue();

              Map<String, Object> maxRuntimeAgg = (Map<String, Object>) bucket.get("max_runtime");
              if (maxRuntimeAgg != null && maxRuntimeAgg.get("value") != null) {
                maxRuntime = ((Number) maxRuntimeAgg.get("value")).longValue();
              }

              Map<String, Object> minRuntimeAgg = (Map<String, Object>) bucket.get("min_runtime");
              if (minRuntimeAgg != null && minRuntimeAgg.get("value") != null) {
                long minValue = ((Number) minRuntimeAgg.get("value")).longValue();
                minRuntime = (minValue == Long.MAX_VALUE) ? 0 : minValue;
              }

              Map<String, Object> avgRuntimeAgg = (Map<String, Object>) bucket.get("avg_runtime");
              if (avgRuntimeAgg != null && avgRuntimeAgg.get("value") != null) {
                avgRuntime = ((Number) avgRuntimeAgg.get("value")).doubleValue();
              }

              trend.setMaxRuntime(maxRuntime);
              trend.setMinRuntime(minRuntime);
              trend.setAvgRuntime(avgRuntime);
              trend.setTotalPipelines(totalPipelines);

              trends.add(trend);
            } catch (Exception e) {
              LOG.warn("Failed to parse runtime trend bucket: {}", e.getMessage());
            }
          }
        }
      }

      trendList.setData(trends);

      java.time.Instant startInstant = java.time.Instant.ofEpochMilli(startTs);
      java.time.Instant endInstant = java.time.Instant.ofEpochMilli(endTs);
      trendList.setStartDate(startInstant.toString());
      trendList.setEndDate(endInstant.toString());

    } catch (Exception e) {
      LOG.warn("Failed to parse ES response: {}", e.getMessage());
      trendList.setErrorMessage("Failed to parse ES response: " + e.getMessage());
    }

    return trendList;
  }

  private PipelineRuntimeTrendList createEmptyRuntimeTrend(String errorMessage) {
    return new PipelineRuntimeTrendList()
        .withData(new ArrayList<>())
        .withDataAvailable(false)
        .withErrorMessage(errorMessage);
  }
}
