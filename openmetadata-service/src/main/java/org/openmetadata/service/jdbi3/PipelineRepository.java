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
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTagsGracefully;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;
import static org.openmetadata.service.util.EntityUtil.taskMatch;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.Comparator;
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
import org.openmetadata.schema.tests.DataQualityReport;
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
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.indexes.PipelineExecutionIndex;
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
            addDerivedTagsGracefully(
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

    // Index pipeline execution in Elasticsearch for analytics
    try {
      indexPipelineExecutionInES(pipeline, pipelineStatus);
    } catch (Exception e) {
      LOG.error("Failed to index pipeline execution in Elasticsearch", e);
      // Don't fail the entire operation if ES indexing fails
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

  /**
   * Index a pipeline execution record in Elasticsearch for analytics queries.
   * Creates one document per execution with executionId, runtime, and status.
   * This enables the Metrics API, Runtime Trend API, and Execution Trend API to function correctly.
   */
  private void indexPipelineExecutionInES(Pipeline pipeline, PipelineStatus pipelineStatus)
      throws IOException {
    PipelineExecutionIndex pipelineExecutionIndex =
        new PipelineExecutionIndex(pipeline, pipelineStatus);

    Map<String, Object> doc = pipelineExecutionIndex.buildSearchIndexDoc();
    String docId = PipelineExecutionIndex.getDocumentId(pipeline, pipelineStatus);
    String docJson = JsonUtils.pojoToJson(doc);
    String indexName =
        Entity.getSearchRepository().getIndexOrAliasName("pipeline_status_search_index");

    searchRepository.getSearchClient().createEntity(indexName, docId, docJson);

    LOG.debug(
        "Indexed pipeline execution for {} with executionId {} to index {}",
        pipeline.getFullyQualifiedName(),
        pipelineStatus.getExecutionId(),
        indexName);
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
   * @param pipelineFqn the pipeline fully qualified name
   * @return PipelineObservabilityResponse containing observability data grouped by tables
   */
  public PipelineObservabilityResponse getPipelineObservability(String pipelineFqn) {
    return getPipelineObservability(pipelineFqn, null, null, null, null, 10);
  }

  /**
   * Get pipeline observability data for all tables associated with a pipeline with filters.
   *
   * @param pipelineFqn the pipeline fully qualified name
   * @param status filter by execution status (Successful, Failed, Running, Pending, Skipped)
   * @param startTs filter observability data after this timestamp
   * @param endTs filter observability data before this timestamp
   * @param serviceType filter by pipeline service type (e.g., Airflow, Dagster)
   * @param limit limit the number of observability records per table
   * @return PipelineObservabilityResponse containing observability data grouped by tables
   */
  public PipelineObservabilityResponse getPipelineObservability(
      String pipelineFqn, String status, Long startTs, Long endTs, String serviceType, int limit) {
    // Get the pipeline entity to retrieve its ID
    Pipeline pipeline = findByName(pipelineFqn, NON_DELETED);
    if (pipeline == null) {
      throw new EntityNotFoundException(
          String.format("Pipeline with FQN %s not found", pipelineFqn));
    }

    UUID pipelineId = pipeline.getId();

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

          // Parse and filter observability data for this table
          List<org.openmetadata.schema.type.PipelineObservability> observabilityData =
              new ArrayList<>();
          for (CollectionDAO.ExtensionWithIdAndSchemaObject record : tableRecords) {
            if (record.getExtension().equals(extensionKey)) {
              org.openmetadata.schema.type.PipelineObservability observability =
                  JsonUtils.readValue(
                      record.getJson(), org.openmetadata.schema.type.PipelineObservability.class);

              // Apply filters
              boolean matchesFilter = true;

              // Filter by status
              if (status != null && !status.isEmpty() && observability.getLastRunStatus() != null) {
                matchesFilter =
                    observability.getLastRunStatus().value().equalsIgnoreCase(status.trim());
              }

              // Filter by service type
              if (matchesFilter
                  && serviceType != null
                  && !serviceType.isEmpty()
                  && observability.getPipeline() != null) {
                Pipeline relatedPipeline =
                    findByName(observability.getPipeline().getFullyQualifiedName(), NON_DELETED);
                if (relatedPipeline != null
                    && relatedPipeline.getServiceType() != null
                    && !relatedPipeline
                        .getServiceType()
                        .value()
                        .equalsIgnoreCase(serviceType.trim())) {
                  matchesFilter = false;
                }
              }

              // Filter by time range (using lastRunTime)
              if (matchesFilter && observability.getLastRunTime() != null) {
                if (startTs != null && observability.getLastRunTime() < startTs) {
                  matchesFilter = false;
                }
                if (endTs != null && observability.getLastRunTime() > endTs) {
                  matchesFilter = false;
                }
              }

              // Add if matches all filters
              if (matchesFilter) {
                observabilityData.add(observability);
                // Apply limit per table
                if (observabilityData.size() >= limit) {
                  break;
                }
              }
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

    // Decode the cursors before passing to ResultList constructor to avoid double-encoding
    // The cursors from pipelines.getPaging() are already Base64-encoded
    // ResultList constructor will encode them again, so we need to decode first
    String decodedBefore = null;
    String decodedAfter = null;

    try {
      if (beforeCursor != null) {
        decodedBefore =
            new String(Base64.getUrlDecoder().decode(beforeCursor), StandardCharsets.UTF_8);
      }
      if (afterCursor != null) {
        decodedAfter =
            new String(Base64.getUrlDecoder().decode(afterCursor), StandardCharsets.UTF_8);
      }
    } catch (IllegalArgumentException e) {
      LOG.warn("Failed to decode pagination cursors: {}", e.getMessage());
      // If decoding fails, use the cursors as-is (they might not be encoded)
      decodedBefore = beforeCursor;
      decodedAfter = afterCursor;
    }

    return new ResultList<>(summaries, decodedBefore, decodedAfter, total != null ? total : 0);
  }

  private PipelineSummary buildPipelineSummary(Pipeline pipeline) {
    PipelineSummary summary = new PipelineSummary();

    summary.setPipelineId(pipeline.getId());
    summary.setPipelineName(pipeline.getName());
    summary.setPipelineFqn(pipeline.getFullyQualifiedName());
    summary.setServiceType(pipeline.getServiceType());

    if (pipeline.getStartDate() != null) {
      summary.setStartTime(pipeline.getStartDate().getTime());
    }

    if (pipeline.getEndDate() != null) {
      summary.setEndTime(pipeline.getEndDate().getTime());
    }

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
        .withStartTime(pipeline.getStartDate() != null ? pipeline.getStartDate().getTime() : null)
        .withEndTime(pipeline.getEndDate() != null ? pipeline.getEndDate().getTime() : null)
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

  public PipelineMetrics getPipelineMetrics() {
    return getPipelineMetrics(null);
  }

  public PipelineMetrics getPipelineMetrics(String query) {
    try {
      return getPipelineMetricsFromES(query);
    } catch (Exception e) {
      LOG.warn("Failed to get metrics from Elasticsearch: {}", e.getMessage());
      return createEmptyMetrics("Elasticsearch unavailable: " + e.getMessage());
    }
  }

  private PipelineMetrics getPipelineMetricsFromES(String query) throws IOException {
    try {
      String pipelineIndex = "pipeline_search_index";
      String pipelineStatusIndex = "pipeline_status_search_index";
      String q = nullOrEmpty(query) ? "*" : query;

      // Query pipeline_search_index for service breakdown (which gives us all metrics we need)
      // terms aggregation returns buckets with service names and pipeline counts
      String pipelineAggQuery =
          "bucketName=service_breakdown:aggType=terms:field=service.name.keyword&size=1000";

      SearchAggregation pipelineAgg = SearchIndexUtils.buildAggregationTree(pipelineAggQuery);

      LOG.info(
          "Executing pipeline metrics aggregation on pipeline_search_index with query: '{}'", q);
      DataQualityReport pipelineReport =
          searchRepository.genericAggregation(q, pipelineIndex, pipelineAgg);

      LOG.info(
          "Pipeline report data: {}", pipelineReport != null ? pipelineReport.getData() : "null");

      // Query 1: Get distinct pipeline count (all pipelines with at least one status)
      String cardinalityAggQuery =
          "bucketName=distinct_pipelines:aggType=cardinality:field=pipelineFqn";
      SearchAggregation cardinalityAgg = SearchIndexUtils.buildAggregationTree(cardinalityAggQuery);

      DataQualityReport cardinalityReport = null;
      try {
        cardinalityReport =
            searchRepository.genericAggregation(
                "{\"exists\":{\"field\":\"executionId\"}}", pipelineStatusIndex, cardinalityAgg);
      } catch (Exception e) {
        LOG.warn("Failed to get cardinality: {}", e.getMessage());
      }

      // Query 2: Get distinct pipelines with Successful status
      DataQualityReport successfulReport = null;
      try {
        successfulReport =
            searchRepository.genericAggregation(
                "{\"bool\":{\"must\":[{\"term\":{\"executionStatus\":\"Successful\"}},{\"exists\":{\"field\":\"executionId\"}}]}}",
                pipelineStatusIndex,
                cardinalityAgg);
      } catch (Exception e) {
        LOG.warn("Failed to get successful pipelines count: {}", e.getMessage());
      }

      // Query 3: Get distinct pipelines with Failed status
      DataQualityReport failedReport = null;
      try {
        failedReport =
            searchRepository.genericAggregation(
                "{\"bool\":{\"must\":[{\"term\":{\"executionStatus\":\"Failed\"}},{\"exists\":{\"field\":\"executionId\"}}]}}",
                pipelineStatusIndex,
                cardinalityAgg);
      } catch (Exception e) {
        LOG.warn("Failed to get failed pipelines count: {}", e.getMessage());
      }

      return parseMetricsFromReports(
          pipelineReport, cardinalityReport, successfulReport, failedReport);

    } catch (Exception e) {
      LOG.error("Failed to get pipeline metrics: {}", e.getMessage(), e);
      throw new IOException("Failed to execute pipeline metrics query", e);
    }
  }

  private PipelineMetrics parseMetricsFromReports(
      DataQualityReport pipelineReport,
      DataQualityReport cardinalityReport,
      DataQualityReport successfulReport,
      DataQualityReport failedReport) {
    PipelineMetrics metrics = new PipelineMetrics();
    metrics.setDataAvailable(true);

    try {
      // Parse pipeline report for total count and service breakdown
      if (pipelineReport != null && pipelineReport.getData() != null) {
        List<Map<String, String>> pipelineRows = convertDatumToMapList(pipelineReport.getData());

        int totalPipelines = 0;
        int serviceCount = pipelineRows.size();

        for (Map<String, String> row : pipelineRows) {
          String docCountStr = row.get("document_count");
          if (docCountStr != null) {
            totalPipelines += Integer.parseInt(docCountStr);
          }
        }

        metrics.setTotalPipelines(totalPipelines);
        metrics.setServiceCount(serviceCount);

        parseServiceBreakdownFromData(pipelineRows, metrics);
      }

      // Parse cardinality for active pipelines (distinct pipelines with any execution status)
      int activePipelines = 0;
      if (cardinalityReport != null && cardinalityReport.getMetadata() != null) {
        Object valueObj = cardinalityReport.getMetadata().getAdditionalProperties().get("value");
        if (valueObj != null) {
          activePipelines = ((Number) valueObj).intValue();
        }
      }

      // Parse cardinality for successful pipelines (distinct pipelines with Successful status)
      int successfulPipelines = 0;
      if (successfulReport != null && successfulReport.getMetadata() != null) {
        Object valueObj = successfulReport.getMetadata().getAdditionalProperties().get("value");
        if (valueObj != null) {
          successfulPipelines = ((Number) valueObj).intValue();
        }
      }

      // Parse cardinality for failed pipelines (distinct pipelines with Failed status)
      int failedPipelines = 0;
      if (failedReport != null && failedReport.getMetadata() != null) {
        Object valueObj = failedReport.getMetadata().getAdditionalProperties().get("value");
        if (valueObj != null) {
          failedPipelines = ((Number) valueObj).intValue();
        }
      }

      metrics.setActivePipelines(activePipelines);
      metrics.setSuccessfulPipelines(successfulPipelines);
      metrics.setFailedPipelines(failedPipelines);
      metrics.setInactivePipelines(
          metrics.getTotalPipelines() != null
              ? Math.max(0, metrics.getTotalPipelines() - activePipelines)
              : 0);
      metrics.setPipelinesWithoutStatus(metrics.getInactivePipelines());

    } catch (Exception e) {
      LOG.warn("Failed to parse metrics reports: {}", e.getMessage(), e);
      metrics.setErrorMessage("Failed to parse aggregation results");
    }

    return metrics;
  }

  private List<Map<String, String>> convertDatumToMapList(
      List<org.openmetadata.schema.tests.Datum> data) {
    List<Map<String, String>> rows = new ArrayList<>();
    for (org.openmetadata.schema.tests.Datum datum : data) {
      if (datum.getAdditionalProperties() != null) {
        LOG.debug(
            "Row data keys: {}, values: {}",
            datum.getAdditionalProperties().keySet(),
            datum.getAdditionalProperties());
        rows.add(datum.getAdditionalProperties());
      }
    }
    LOG.debug("Total rows converted: {}", rows.size());
    return rows;
  }

  private void parseServiceBreakdownFromData(
      List<Map<String, String>> data, PipelineMetrics metrics) {
    List<ServiceBreakdown> serviceBreakdowns = new ArrayList<>();

    try {
      // The data structure from aggregations:
      // - Bucket names become column names (service_breakdown, service_type)
      // - Values become row values
      // - document_count is automatically added for terms aggregations

      LOG.info("Parsing service breakdown from {} rows", data.size());

      // Group by service name
      Map<String, ServiceBreakdown> serviceMap = new HashMap<>();

      for (Map<String, String> row : data) {
        LOG.info("Processing service breakdown row with keys: {}, values: {}", row.keySet(), row);

        // terms aggregation returns field name as key: service.name.keyword
        if (row.containsKey("service.name.keyword")) {
          String serviceName =
              row.get("service.name.keyword") != null ? row.get("service.name.keyword") : "Unknown";
          String docCountStr = row.get("document_count") != null ? row.get("document_count") : "0";
          int count = Integer.parseInt(docCountStr);

          ServiceBreakdown breakdown =
              serviceMap.computeIfAbsent(
                  serviceName,
                  k -> {
                    ServiceBreakdown sb = new ServiceBreakdown();
                    sb.setServiceName(serviceName);
                    sb.setCount(0);
                    return sb;
                  });

          breakdown.setCount(breakdown.getCount() + count);

          // Nested aggregation becomes a column in the same row
          if (row.containsKey("service_type")) {
            breakdown.setServiceType(row.get("service_type"));
          }
        }
      }

      serviceBreakdowns.addAll(serviceMap.values());
      LOG.info("Parsed {} service breakdowns: {}", serviceBreakdowns.size(), serviceBreakdowns);
    } catch (Exception e) {
      LOG.warn("Failed to parse service breakdown: {}", e.getMessage(), e);
    }

    metrics.setServiceBreakdown(serviceBreakdowns);
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
      Long startTs,
      Long endTs,
      String pipelineFqn,
      String serviceType,
      Integer limit,
      Integer offset) {
    try {
      return getPipelineExecutionTrendFromES(
          startTs, endTs, pipelineFqn, serviceType, limit, offset);
    } catch (Exception e) {
      LOG.warn("Failed to get execution trend from Elasticsearch: {}", e.getMessage());
      return createEmptyExecutionTrend("Elasticsearch unavailable: " + e.getMessage());
    }
  }

  private PipelineExecutionTrendList getPipelineExecutionTrendFromES(
      Long startTs,
      Long endTs,
      String pipelineFqn,
      String serviceType,
      Integer limit,
      Integer offset)
      throws IOException {
    try {
      String pipelineStatusIndex = "pipeline_status_search_index";

      StringBuilder queryBuilder = new StringBuilder();
      queryBuilder.append("{\"bool\":{\"must\":[");
      queryBuilder
          .append("{\"range\":{\"timestamp\":{\"gte\":")
          .append(startTs)
          .append(",\"lte\":")
          .append(endTs)
          .append("}}}");

      if (pipelineFqn != null && !pipelineFqn.isEmpty()) {
        queryBuilder.append(",{\"term\":{\"pipelineFqn\":\"").append(pipelineFqn).append("\"}}");
      }

      if (serviceType != null && !serviceType.isEmpty()) {
        queryBuilder.append(",{\"term\":{\"serviceType\":\"").append(serviceType).append("\"}}");
      }

      queryBuilder.append("]}}");
      String filterQuery = queryBuilder.toString();

      // Note: extended_bounds and min_doc_count are not yet supported by
      // ElasticDateHistogramAggregations
      // This means only days with actual data will be returned (no zero-count days)
      String aggregationQuery =
          "bucketName=execution_by_date:aggType=date_histogram:field=timestamp&calendar_interval=day,"
              + "bucketName=status_breakdown:aggType=terms:field=executionStatus";

      SearchAggregation searchAggregation = SearchIndexUtils.buildAggregationTree(aggregationQuery);

      DataQualityReport report =
          searchRepository.genericAggregation(filterQuery, pipelineStatusIndex, searchAggregation);

      return parseExecutionTrendFromReport(report, startTs, endTs, limit, offset);

    } catch (Exception e) {
      LOG.error("Failed to get pipeline execution trend: {}", e.getMessage(), e);
      throw new IOException("Failed to execute pipeline execution trend query", e);
    }
  }

  private PipelineExecutionTrendList parseExecutionTrendFromReport(
      DataQualityReport report, Long startTs, Long endTs, Integer limit, Integer offset) {
    PipelineExecutionTrendList trendList = new PipelineExecutionTrendList();
    List<PipelineExecutionTrend> trends = new ArrayList<>();

    int totalSuccess = 0;
    int totalFailed = 0;
    int totalExecutions = 0;

    try {
      List<org.openmetadata.schema.tests.Datum> data = report.getData();
      if (data != null && !data.isEmpty()) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (org.openmetadata.schema.tests.Datum datum : data) {
          if (datum.getAdditionalProperties() != null) {
            rows.add(datum.getAdditionalProperties());
          }
        }

        Map<String, Map<String, Integer>> dateStatusMap = new HashMap<>();

        for (Map<String, String> row : rows) {
          if (row.containsKey("timestamp")) {
            String dateKey = row.get("timestamp");
            String status = row.containsKey("executionStatus") ? row.get("executionStatus") : "";
            String docCountStr =
                row.get("document_count") != null ? row.get("document_count") : "0";
            int count = Integer.parseInt(docCountStr);

            dateStatusMap.putIfAbsent(dateKey, new HashMap<>());
            dateStatusMap.get(dateKey).put(status, count);
          }
        }

        // Convert grouped data to trend objects
        for (Map.Entry<String, Map<String, Integer>> entry : dateStatusMap.entrySet()) {
          try {
            Long timestamp = Long.parseLong(entry.getKey());
            Map<String, Integer> statusCounts = entry.getValue();

            PipelineExecutionTrend trend = new PipelineExecutionTrend();
            trend.setTimestamp(timestamp);
            trend.setDate(java.time.Instant.ofEpochMilli(timestamp).toString());

            // Status values are lowercased by Elasticsearch's lowercase_normalizer
            int success = statusCounts.getOrDefault("successful", 0);
            int failed = statusCounts.getOrDefault("failed", 0);
            int pending = statusCounts.getOrDefault("pending", 0);
            int skipped = statusCounts.getOrDefault("skipped", 0);
            int running = statusCounts.getOrDefault("running", 0);
            int total = success + failed + pending + skipped + running;

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
            LOG.warn(
                "Failed to parse execution trend for date {}: {}", entry.getKey(), e.getMessage());
          }
        }

        trends.sort(Comparator.comparing(PipelineExecutionTrend::getTimestamp));
      }

      // Apply pagination following DashboardDataModelRepository pattern
      int total = trends.size();
      int fromIndex = Math.min(offset != null ? offset : 0, total);
      int toIndex = Math.min(fromIndex + (limit != null ? limit : 30), total);

      List<PipelineExecutionTrend> paginatedTrends = trends.subList(fromIndex, toIndex);

      // Calculate pagination metadata
      String before =
          fromIndex > 0
              ? String.valueOf(Math.max(0, fromIndex - (limit != null ? limit : 30)))
              : null;
      String after = toIndex < total ? String.valueOf(toIndex) : null;

      // Set paginated data
      trendList.setData(paginatedTrends);
      trendList.setPaging(
          new org.openmetadata.schema.type.Paging()
              .withBefore(before)
              .withAfter(after)
              .withTotal(total));

      trendList.setTotalSuccessful(totalSuccess);
      trendList.setTotalFailed(totalFailed);
      trendList.setTotalExecutions(totalExecutions);

      java.time.Instant startInstant = java.time.Instant.ofEpochMilli(startTs);
      java.time.Instant endInstant = java.time.Instant.ofEpochMilli(endTs);
      trendList.setStartDate(startInstant.toString());
      trendList.setEndDate(endInstant.toString());

      trendList.setDataAvailable(!paginatedTrends.isEmpty());

    } catch (Exception e) {
      LOG.warn("Failed to parse DataQualityReport: {}", e.getMessage(), e);
      trendList.setErrorMessage("Failed to parse aggregation results: " + e.getMessage());
      trendList.setDataAvailable(false);
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
      Long startTs,
      Long endTs,
      String pipelineFqn,
      String serviceType,
      Integer limit,
      Integer offset) {
    try {
      return getPipelineRuntimeTrendFromES(startTs, endTs, pipelineFqn, serviceType, limit, offset);
    } catch (Exception e) {
      LOG.warn("Failed to get runtime trend from Elasticsearch: {}", e.getMessage());
      return createEmptyRuntimeTrend("Elasticsearch unavailable: " + e.getMessage());
    }
  }

  private PipelineRuntimeTrendList getPipelineRuntimeTrendFromES(
      Long startTs,
      Long endTs,
      String pipelineFqn,
      String serviceType,
      Integer limit,
      Integer offset)
      throws IOException {
    try {
      String pipelineStatusIndex = "pipeline_status_search_index";

      StringBuilder queryBuilder = new StringBuilder();
      queryBuilder.append("{\"bool\":{\"must\":[");
      queryBuilder
          .append("{\"range\":{\"timestamp\":{\"gte\":")
          .append(startTs)
          .append(",\"lte\":")
          .append(endTs)
          .append("}}}");

      // Filter to only include documents that have endTime (required for runtime calculation)
      queryBuilder.append(",{\"exists\":{\"field\":\"endTime\"}}");

      // Filter to only include execution records (exclude relationship documents)
      queryBuilder.append(",{\"exists\":{\"field\":\"executionId\"}}");

      if (pipelineFqn != null && !pipelineFqn.isEmpty()) {
        queryBuilder.append(",{\"term\":{\"pipelineFqn\":\"").append(pipelineFqn).append("\"}}");
      }

      if (serviceType != null && !serviceType.isEmpty()) {
        queryBuilder.append(",{\"term\":{\"serviceType\":\"").append(serviceType).append("\"}}");
      }

      queryBuilder.append("]}}");
      String filterQuery = queryBuilder.toString();

      // Due to framework limitation with sibling aggregations, we need to query each metric
      // separately.
      // The framework's traverseAggregationResults() only processes the first sibling metric.

      // Query 1: Get max runtime and document count
      String maxQuery =
          "bucketName=runtime_by_date:aggType=date_histogram:field=timestamp&calendar_interval=day,"
              + "bucketName=max_runtime:aggType=max:field=runtime";
      SearchAggregation maxAggregation = SearchIndexUtils.buildAggregationTree(maxQuery);
      DataQualityReport maxReport =
          searchRepository.genericAggregation(filterQuery, pipelineStatusIndex, maxAggregation);

      // Query 2: Get min runtime
      String minQuery =
          "bucketName=runtime_by_date:aggType=date_histogram:field=timestamp&calendar_interval=day,"
              + "bucketName=min_runtime:aggType=min:field=runtime";
      SearchAggregation minAggregation = SearchIndexUtils.buildAggregationTree(minQuery);
      DataQualityReport minReport =
          searchRepository.genericAggregation(filterQuery, pipelineStatusIndex, minAggregation);

      // Query 3: Get avg runtime
      String avgQuery =
          "bucketName=runtime_by_date:aggType=date_histogram:field=timestamp&calendar_interval=day,"
              + "bucketName=avg_runtime:aggType=avg:field=runtime";
      SearchAggregation avgAggregation = SearchIndexUtils.buildAggregationTree(avgQuery);
      DataQualityReport avgReport =
          searchRepository.genericAggregation(filterQuery, pipelineStatusIndex, avgAggregation);

      // Query 4: Get cardinality (distinct pipeline count) per day
      String cardinalityQuery =
          "bucketName=runtime_by_date:aggType=date_histogram:field=timestamp&calendar_interval=day,"
              + "bucketName=distinct_pipelines:aggType=cardinality:field=pipelineFqn";
      SearchAggregation cardinalityAggregation =
          SearchIndexUtils.buildAggregationTree(cardinalityQuery);
      DataQualityReport cardinalityReport =
          searchRepository.genericAggregation(
              filterQuery, pipelineStatusIndex, cardinalityAggregation);

      return parseRuntimeTrendFromSeparateReports(
          maxReport, minReport, avgReport, cardinalityReport, startTs, endTs, limit, offset);

    } catch (Exception e) {
      LOG.error("Failed to get pipeline runtime trend: {}", e.getMessage(), e);
      throw new IOException("Failed to execute pipeline runtime trend query", e);
    }
  }

  private PipelineRuntimeTrendList parseRuntimeTrendFromSeparateReports(
      DataQualityReport maxReport,
      DataQualityReport minReport,
      DataQualityReport avgReport,
      DataQualityReport cardinalityReport,
      Long startTs,
      Long endTs,
      Integer limit,
      Integer offset) {
    PipelineRuntimeTrendList trendList = new PipelineRuntimeTrendList();
    List<PipelineRuntimeTrend> trends = new ArrayList<>();

    try {
      LOG.info("Parsing runtime trends from separate reports");

      // Extract max runtime by date
      Map<String, Double> maxRuntimeByDate = new HashMap<>();
      if (maxReport.getData() != null) {
        for (org.openmetadata.schema.tests.Datum datum : maxReport.getData()) {
          Map<String, String> row = datum.getAdditionalProperties();
          if (row != null && row.containsKey("timestamp") && row.containsKey("runtime")) {
            String timestamp = row.get("timestamp");
            try {
              maxRuntimeByDate.put(timestamp, Double.parseDouble(row.get("runtime")));
              LOG.info("Max runtime for {}: {}", timestamp, row.get("runtime"));
            } catch (NumberFormatException e) {
              LOG.warn("Invalid max runtime value for timestamp {}: {}", timestamp, e.getMessage());
            }
          }
        }
      }

      // Extract min runtime by date
      Map<String, Double> minRuntimeByDate = new HashMap<>();
      if (minReport.getData() != null) {
        for (org.openmetadata.schema.tests.Datum datum : minReport.getData()) {
          Map<String, String> row = datum.getAdditionalProperties();
          if (row != null && row.containsKey("timestamp") && row.containsKey("runtime")) {
            String timestamp = row.get("timestamp");
            try {
              minRuntimeByDate.put(timestamp, Double.parseDouble(row.get("runtime")));
              LOG.info("Min runtime for {}: {}", timestamp, row.get("runtime"));
            } catch (NumberFormatException e) {
              LOG.warn("Invalid min runtime value for timestamp {}: {}", timestamp, e.getMessage());
            }
          }
        }
      }

      // Extract avg runtime by date
      Map<String, Double> avgRuntimeByDate = new HashMap<>();
      if (avgReport.getData() != null) {
        for (org.openmetadata.schema.tests.Datum datum : avgReport.getData()) {
          Map<String, String> row = datum.getAdditionalProperties();
          if (row != null && row.containsKey("timestamp") && row.containsKey("runtime")) {
            String timestamp = row.get("timestamp");
            try {
              avgRuntimeByDate.put(timestamp, Double.parseDouble(row.get("runtime")));
              LOG.info("Avg runtime for {}: {}", timestamp, row.get("runtime"));
            } catch (NumberFormatException e) {
              LOG.warn("Invalid avg runtime value for timestamp {}: {}", timestamp, e.getMessage());
            }
          }
        }
      }

      // Extract cardinality (distinct pipeline count) by date
      // The OpenMetadata aggregation framework doesn't properly return nested cardinality metrics
      // So we count distinct pipelineFqn values from the data instead
      Map<String, Integer> cardinalityByDate = new HashMap<>();
      if (cardinalityReport != null && cardinalityReport.getData() != null) {
        // Group by timestamp and count distinct pipelineFqn
        Map<String, Set<String>> pipelinesByDate = new HashMap<>();

        for (org.openmetadata.schema.tests.Datum datum : cardinalityReport.getData()) {
          Map<String, String> row = datum.getAdditionalProperties();
          if (row != null && row.containsKey("timestamp") && row.containsKey("pipelineFqn")) {
            String timestamp = row.get("timestamp");
            String pipelineFqn = row.get("pipelineFqn");

            pipelinesByDate.computeIfAbsent(timestamp, k -> new HashSet<>()).add(pipelineFqn);
          }
        }

        // Convert to cardinality map
        for (Map.Entry<String, Set<String>> entry : pipelinesByDate.entrySet()) {
          int distinctCount = entry.getValue().size();
          cardinalityByDate.put(entry.getKey(), distinctCount);
          LOG.info("Distinct pipelines for {}: {}", entry.getKey(), distinctCount);
        }
      }

      LOG.info(
          "Parsed data - Max: {} dates, Min: {} dates, Avg: {} dates, Cardinality: {} dates",
          maxRuntimeByDate.size(),
          minRuntimeByDate.size(),
          avgRuntimeByDate.size(),
          cardinalityByDate.size());

      // Combine all metrics for each date
      Set<String> allDates = new HashSet<>();
      allDates.addAll(maxRuntimeByDate.keySet());
      allDates.addAll(minRuntimeByDate.keySet());
      allDates.addAll(avgRuntimeByDate.keySet());
      allDates.addAll(cardinalityByDate.keySet());

      for (String timestampStr : allDates) {
        try {
          Long timestamp = Long.parseLong(timestampStr);

          PipelineRuntimeTrend trend = new PipelineRuntimeTrend();
          trend.setTimestamp(timestamp);
          trend.setDate(java.time.Instant.ofEpochMilli(timestamp).toString());

          // Get metrics for this date (default to 0 if not present)
          double maxRuntime = maxRuntimeByDate.getOrDefault(timestampStr, 0.0);
          double minRuntime = minRuntimeByDate.getOrDefault(timestampStr, 0.0);
          double avgRuntime = avgRuntimeByDate.getOrDefault(timestampStr, 0.0);
          int totalPipelines = cardinalityByDate.getOrDefault(timestampStr, 0);

          trend.setMaxRuntime(maxRuntime);
          trend.setMinRuntime(minRuntime);
          trend.setAvgRuntime(avgRuntime);
          trend.setTotalPipelines(totalPipelines);

          LOG.info(
              "Combined trend for {}: max={}, min={}, avg={}, totalPipelines={}",
              timestamp,
              maxRuntime,
              minRuntime,
              avgRuntime,
              totalPipelines);

          trends.add(trend);
        } catch (Exception e) {
          LOG.warn(
              "Failed to parse runtime trend for timestamp {}: {}", timestampStr, e.getMessage());
        }
      }

      trends.sort(Comparator.comparing(PipelineRuntimeTrend::getTimestamp));

      // Apply pagination following DashboardDataModelRepository pattern
      int total = trends.size();
      int fromIndex = Math.min(offset != null ? offset : 0, total);
      int toIndex = Math.min(fromIndex + (limit != null ? limit : 30), total);

      List<PipelineRuntimeTrend> paginatedTrends = trends.subList(fromIndex, toIndex);

      // Calculate pagination metadata
      String before =
          fromIndex > 0
              ? String.valueOf(Math.max(0, fromIndex - (limit != null ? limit : 30)))
              : null;
      String after = toIndex < total ? String.valueOf(toIndex) : null;

      // Set paginated data
      trendList.setData(paginatedTrends);
      trendList.setPaging(
          new org.openmetadata.schema.type.Paging()
              .withBefore(before)
              .withAfter(after)
              .withTotal(total));

      java.time.Instant startInstant = java.time.Instant.ofEpochMilli(startTs);
      java.time.Instant endInstant = java.time.Instant.ofEpochMilli(endTs);
      trendList.setStartDate(startInstant.toString());
      trendList.setEndDate(endInstant.toString());

      trendList.setDataAvailable(!paginatedTrends.isEmpty());

    } catch (Exception e) {
      LOG.warn("Failed to parse DataQualityReport: {}", e.getMessage(), e);
      trendList.setErrorMessage("Failed to parse aggregation results: " + e.getMessage());
      trendList.setDataAvailable(false);
    }

    return trendList;
  }

  private PipelineRuntimeTrendList createEmptyRuntimeTrend(String errorMessage) {
    return new PipelineRuntimeTrendList()
        .withData(new ArrayList<>())
        .withDataAvailable(false)
        .withErrorMessage(errorMessage);
  }

  /**
   * Reindex all pipeline execution records from MySQL to Elasticsearch.
   * Used for backfilling existing data after deploying the indexing fix.
   * This method should be called manually after deployment to populate ES with historical data.
   */
  public void reindexPipelineExecutions() throws IOException {
    LOG.info("Starting pipeline execution reindexing from MySQL to Elasticsearch");

    // Get all pipelines
    ListFilter filter = new ListFilter(NON_DELETED);
    List<Pipeline> pipelines = listAll(new Fields(Set.of("service")), filter);

    int totalIndexed = 0;
    int totalFailed = 0;

    for (Pipeline pipeline : pipelines) {
      try {
        String pipelineFqn = pipeline.getFullyQualifiedName();

        // Get all pipeline statuses from time series
        List<PipelineStatus> statuses =
            JsonUtils.readObjects(
                getResultsFromAndToTimestamps(pipelineFqn, PIPELINE_STATUS_EXTENSION, null, null),
                PipelineStatus.class);

        LOG.info("Reindexing {} executions for pipeline {}", statuses.size(), pipelineFqn);

        // Index each status
        for (PipelineStatus status : statuses) {
          try {
            indexPipelineExecutionInES(pipeline, status);
            totalIndexed++;
          } catch (Exception e) {
            LOG.error(
                "Failed to index execution {} for pipeline {}",
                status.getExecutionId(),
                pipelineFqn,
                e);
            totalFailed++;
          }
        }
      } catch (Exception e) {
        LOG.error("Failed to reindex pipeline {}", pipeline.getFullyQualifiedName(), e);
        totalFailed++;
      }
    }

    LOG.info(
        "Pipeline execution reindexing completed. Indexed: {}, Failed: {}",
        totalIndexed,
        totalFailed);
  }
}
