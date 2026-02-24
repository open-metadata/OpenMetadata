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
import static org.openmetadata.schema.type.EventType.ENTITY_NO_CHANGE;
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

import com.google.gson.Gson;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
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
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.pipelines.PipelineResource;
import org.openmetadata.service.search.indexes.PipelineExecutionIndex;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
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
  public void setFields(Pipeline pipeline, Fields fields, RelationIncludes relationIncludes) {
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
    PipelineStatus status =
        JsonUtils.readValue(
            getLatestExtensionFromTimeSeries(
                pipeline.getFullyQualifiedName(), PIPELINE_STATUS_EXTENSION),
            PipelineStatus.class);

    if (status != null && status.getTaskStatus() != null && !status.getTaskStatus().isEmpty()) {
      status
          .getTaskStatus()
          .sort(
              (t1, t2) -> {
                Long start1 = t1.getStartTime();
                Long start2 = t2.getStartTime();
                if (start1 == null && start2 == null) return 0;
                if (start1 == null) return 1;
                if (start2 == null) return -1;
                return start1.compareTo(start2);
              });
    }

    return status;
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

    // Update the pipeline's own ES index with latest status
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

  public RestUtil.PutResponse<?> addBulkPipelineStatus(
      String fqn, List<PipelineStatus> pipelineStatuses) {
    Pipeline pipeline = daoCollection.pipelineDAO().findEntityByName(fqn);
    pipeline.setService(getContainer(pipeline.getId()));

    if (pipelineStatuses == null || pipelineStatuses.isEmpty()) {
      return new RestUtil.PutResponse<>(Response.Status.OK, pipeline, ENTITY_NO_CHANGE);
    }

    Set<String> validatedTasks = new HashSet<>();
    for (PipelineStatus pipelineStatus : pipelineStatuses) {
      for (Status taskStatus : listOrEmpty(pipelineStatus.getTaskStatus())) {
        if (validatedTasks.add(taskStatus.getName())) {
          validateTask(pipeline, taskStatus.getName());
        }
      }
    }

    PipelineStatus latestStatus = null;
    for (PipelineStatus pipelineStatus : pipelineStatuses) {
      if (latestStatus == null || pipelineStatus.getTimestamp() > latestStatus.getTimestamp()) {
        latestStatus = pipelineStatus;
      }
    }

    bulkUpsertPipelineStatuses(pipeline.getFullyQualifiedName(), pipelineStatuses);

    searchRepository.bulkIndexPipelineExecutions(pipeline, pipelineStatuses);

    if (RdfUpdater.isEnabled() && latestStatus != null) {
      storePipelineExecutionInRdf(pipeline, latestStatus);
    }

    pipeline.setPipelineStatus(latestStatus);
    ChangeDescription change =
        addPipelineStatusChangeDescription(pipeline.getVersion(), latestStatus, null);
    pipeline.setChangeDescription(change);
    pipeline.setIncrementalChangeDescription(change);

    try {
      searchRepository.updateEntityIndex(pipeline);
    } catch (Exception e) {
      LOG.error("Failed to update pipeline entity index in Elasticsearch", e);
    }

    return new RestUtil.PutResponse<>(
        Response.Status.OK,
        pipeline.withPipelineStatus(latestStatus).withUpdatedAt(System.currentTimeMillis()),
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

  private void bulkUpsertPipelineStatuses(String fqn, List<PipelineStatus> pipelineStatuses) {
    String entityFQNHash = FullyQualifiedName.buildHash(fqn);
    String sql;
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      sql =
          "INSERT INTO entity_extension_time_series(entityFQNHash, extension, jsonSchema, json) "
              + "VALUES (:entityFQNHash, :extension, :jsonSchema, :json) "
              + "ON DUPLICATE KEY UPDATE json = VALUES(json)";
    } else {
      sql =
          "INSERT INTO entity_extension_time_series(entityFQNHash, extension, jsonSchema, json) "
              + "VALUES (:entityFQNHash, :extension, :jsonSchema, cast(:json as jsonb)) "
              + "ON CONFLICT (entityFQNHash, extension, timestamp) DO UPDATE SET json = EXCLUDED.json";
    }
    Entity.getJdbi()
        .useHandle(
            handle -> {
              var batch = handle.prepareBatch(sql);
              for (PipelineStatus pipelineStatus : pipelineStatuses) {
                batch
                    .bind("entityFQNHash", entityFQNHash)
                    .bind("extension", PIPELINE_STATUS_EXTENSION)
                    .bind("jsonSchema", "pipelineStatus")
                    .bind("json", JsonUtils.pojoToJson(pipelineStatus))
                    .add();
              }
              batch.execute();
            });
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

  private Long calculateActualDuration(PipelineStatus pipelineStatus) {
    if (pipelineStatus.getTaskStatus() == null || pipelineStatus.getTaskStatus().isEmpty()) {
      return null;
    }

    Long minStartTime =
        pipelineStatus.getTaskStatus().stream()
            .map(task -> task.getStartTime())
            .filter(java.util.Objects::nonNull)
            .min(Long::compare)
            .orElse(null);

    Long maxEndTime =
        pipelineStatus.getTaskStatus().stream()
            .map(task -> task.getEndTime())
            .filter(java.util.Objects::nonNull)
            .max(Long::compare)
            .orElse(null);

    if (minStartTime != null && maxEndTime != null && maxEndTime >= minStartTime) {
      return maxEndTime - minStartTime;
    }

    return null;
  }

  public ResultList<PipelineStatus> getPipelineStatuses(
      String fqn,
      Long starTs,
      Long endTs,
      Integer limit,
      String before,
      String after,
      String status,
      String search,
      Long minDuration,
      Long maxDuration) {
    List<PipelineStatus> pipelineStatuses;
    pipelineStatuses =
        JsonUtils.readObjects(
            getResultsFromAndToTimestamps(fqn, PIPELINE_STATUS_EXTENSION, starTs, endTs),
            PipelineStatus.class);

    // Apply multi-value status filter
    if (status != null && !status.isEmpty()) {
      List<String> statusValues =
          Arrays.asList(status.split(",")).stream()
              .map(String::trim)
              .collect(java.util.stream.Collectors.toList());
      pipelineStatuses =
          pipelineStatuses.stream()
              .filter(
                  ps ->
                      ps.getExecutionStatus() != null
                          && statusValues.contains(ps.getExecutionStatus().value()))
              .collect(java.util.stream.Collectors.toList());
    }

    // Apply search filter on taskStatus names
    if (search != null && !search.isEmpty()) {
      String searchLower = search.toLowerCase();
      pipelineStatuses =
          pipelineStatuses.stream()
              .map(
                  ps -> {
                    if (ps.getTaskStatus() == null || ps.getTaskStatus().isEmpty()) {
                      return ps;
                    }
                    List<org.openmetadata.schema.type.Status> filteredTasks =
                        ps.getTaskStatus().stream()
                            .filter(
                                task ->
                                    task.getName() != null
                                        && task.getName().toLowerCase().contains(searchLower))
                            .collect(java.util.stream.Collectors.toList());
                    return ps.withTaskStatus(filteredTasks);
                  })
              .filter(ps -> ps.getTaskStatus() != null && !ps.getTaskStatus().isEmpty())
              .collect(java.util.stream.Collectors.toList());
    }

    // Apply duration filters using task-level timings
    if (minDuration != null || maxDuration != null) {
      pipelineStatuses =
          pipelineStatuses.stream()
              .filter(
                  ps -> {
                    Long actualDuration = calculateActualDuration(ps);
                    if (actualDuration == null) {
                      return false;
                    }
                    boolean meetsMin = minDuration == null || actualDuration >= minDuration;
                    boolean meetsMax = maxDuration == null || actualDuration <= maxDuration;
                    return meetsMin && meetsMax;
                  })
              .collect(java.util.stream.Collectors.toList());
    }

    // Sort by timestamp (descending - newest first)
    pipelineStatuses.sort((a, b) -> Long.compare(b.getTimestamp(), a.getTimestamp()));

    // Store total count before pagination
    int total = pipelineStatuses.size();

    // Apply cursor-based pagination
    // Note: With DESCENDING sort (newest first), cursor semantics are:
    // - "before" cursor: get newer records (previous page, higher timestamps)
    // - "after" cursor: get older records (next page, lower timestamps)
    if (before != null) {
      // Pagination BACKWARDS: get newer/previous page records (higher timestamps)
      // Decode base64-encoded cursor before parsing
      String decodedBefore = RestUtil.decodeCursor(before);
      Long beforeTs = Long.parseLong(decodedBefore);
      pipelineStatuses =
          pipelineStatuses.stream()
              .filter(ps -> ps.getTimestamp() > beforeTs)
              .collect(java.util.stream.Collectors.toList());
    } else if (after != null) {
      // Pagination FORWARD: get older/next page records (lower timestamps)
      // Decode base64-encoded cursor before parsing
      String decodedAfter = RestUtil.decodeCursor(after);
      Long afterTs = Long.parseLong(decodedAfter);
      pipelineStatuses =
          pipelineStatuses.stream()
              .filter(ps -> ps.getTimestamp() < afterTs)
              .collect(java.util.stream.Collectors.toList());
    }

    // Apply limit only if provided
    List<PipelineStatus> paginatedResults;
    if (limit != null && limit > 0 && pipelineStatuses.size() > limit) {
      paginatedResults = pipelineStatuses.subList(0, limit);
    } else {
      paginatedResults = pipelineStatuses;
    }

    // Build cursors for pagination - only when limit is provided
    String beforeCursor = null;
    String afterCursor = null;

    // Only generate cursors if pagination is active (limit was provided)
    if (limit != null && !paginatedResults.isEmpty()) {
      beforeCursor = String.valueOf(paginatedResults.get(0).getTimestamp());
      afterCursor =
          String.valueOf(paginatedResults.get(paginatedResults.size() - 1).getTimestamp());
    }

    return new ResultList<>(paginatedResults, beforeCursor, afterCursor, total);
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
  public void storeEntities(List<Pipeline> pipelines) {
    List<Pipeline> entitiesToStore = new ArrayList<>();
    Gson gson = new Gson();

    for (Pipeline pipeline : pipelines) {
      EntityReference service = pipeline.getService();
      List<Task> taskWithTagsAndOwners = pipeline.getTasks();

      pipeline.withService(null);
      pipeline.setTasks(cloneWithoutTagsAndOwners(taskWithTagsAndOwners));

      String jsonCopy = gson.toJson(pipeline);
      entitiesToStore.add(gson.fromJson(jsonCopy, Pipeline.class));

      pipeline.withService(service).withTasks(taskWithTagsAndOwners);
    }

    storeMany(entitiesToStore);
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
  protected void clearEntitySpecificRelationshipsForMany(List<Pipeline> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Pipeline::getId).toList();
    deleteToMany(ids, entityType, Relationship.CONTAINS, null);
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
      recordChange(
          "sourceHash",
          original.getSourceHash(),
          updated.getSourceHash(),
          false,
          EntityUtil.objectMatch,
          false);
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
    return getPipelineObservability(pipelineFqn, null, null, null, null, null, 10, null, null);
  }

  /**
   * Get pipeline observability data for all tables associated with a pipeline with filters and pagination.
   *
   * @param pipelineFqn the pipeline fully qualified name
   * @param status filter by execution status (Successful, Failed, Running, Pending, Skipped)
   * @param startTs filter observability data after this timestamp
   * @param endTs filter observability data before this timestamp
   * @param serviceType filter by pipeline service type (e.g., Airflow, Dagster)
   * @param search search tables by name or FQN
   * @param limit limit the number of tables returned
   * @param before cursor for reverse pagination
   * @param after cursor for forward pagination
   * @return PipelineObservabilityResponse containing observability data grouped by tables
   */
  public PipelineObservabilityResponse getPipelineObservability(
      String pipelineFqn,
      String status,
      Long startTs,
      Long endTs,
      String serviceType,
      String search,
      int limit,
      String before,
      String after) {
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

              // Calculate and set average runtime
              if (observability.getPipeline() != null) {
                Double avgRuntime =
                    calculateAverageRuntime(observability.getPipeline().getFullyQualifiedName());
                observability.setAverageRunTime(avgRuntime);
              }

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

    // Apply search filter
    if (search != null && !search.isEmpty()) {
      String searchLower = search.toLowerCase();
      tableObservabilityList =
          tableObservabilityList.stream()
              .filter(
                  table ->
                      table.getTableFqn() != null
                          && table.getTableFqn().toLowerCase().contains(searchLower))
              .collect(java.util.stream.Collectors.toList());
    }

    // Sort by table FQN for consistent pagination
    tableObservabilityList.sort(
        (a, b) -> {
          String fqnA = a.getTableFqn() != null ? a.getTableFqn() : "";
          String fqnB = b.getTableFqn() != null ? b.getTableFqn() : "";
          return fqnA.compareTo(fqnB);
        });

    // Calculate total before pagination
    int total = tableObservabilityList.size();

    // Apply pagination
    String beforeCursor = null;
    String afterCursor = null;

    try {
      // Decode cursors
      String decodedBefore = before != null ? RestUtil.decodeCursor(before) : null;
      String decodedAfter = after != null ? RestUtil.decodeCursor(after) : null;

      // Find position based on cursor
      int startIndex = 0;
      if (decodedAfter != null) {
        // Forward pagination - find position after cursor
        for (int i = 0; i < tableObservabilityList.size(); i++) {
          if (tableObservabilityList.get(i).getTableFqn().equals(decodedAfter)) {
            startIndex = i + 1;
            break;
          }
        }
      } else if (decodedBefore != null) {
        // Reverse pagination - find position before cursor
        for (int i = tableObservabilityList.size() - 1; i >= 0; i--) {
          if (tableObservabilityList.get(i).getTableFqn().equals(decodedBefore)) {
            startIndex = Math.max(0, i - limit);
            break;
          }
        }
      }

      // Get paginated slice (take limit+1 to determine if more pages exist)
      int endIndex = Math.min(startIndex + limit, tableObservabilityList.size());
      List<TableObservabilityData> paginatedList =
          new ArrayList<>(tableObservabilityList.subList(startIndex, endIndex));

      // Generate cursors
      if (paginatedList.size() > 0) {
        // Generate before cursor if not at start
        if (startIndex > 0) {
          beforeCursor = RestUtil.encodeCursor(paginatedList.get(0).getTableFqn());
        }
        // Generate after cursor if not at end
        if (endIndex < total) {
          afterCursor =
              RestUtil.encodeCursor(paginatedList.get(paginatedList.size() - 1).getTableFqn());
        }
      }

      tableObservabilityList = paginatedList;

    } catch (Exception e) {
      LOG.warn("Failed to decode pagination cursors: {}", e.getMessage());
      // If cursor decoding fails, just return first page
      int endIndex = Math.min(limit, tableObservabilityList.size());
      tableObservabilityList = new ArrayList<>(tableObservabilityList.subList(0, endIndex));
      if (endIndex < total) {
        afterCursor =
            RestUtil.encodeCursor(
                tableObservabilityList.get(tableObservabilityList.size() - 1).getTableFqn());
      }
    }

    return new PipelineObservabilityResponse()
        .withPipelineId(pipelineId)
        .withPipelineFqn(pipelineFqn)
        .withTableObservabilityData(tableObservabilityList)
        .withPaging(
            new org.openmetadata.schema.type.Paging()
                .withBefore(beforeCursor)
                .withAfter(afterCursor)
                .withTotal(total));
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

    // Extract all filter parameters
    String statusFilter = filter.getQueryParams().get("status");
    String searchFilter = filter.getQueryParams().get("search");
    String startTsFilter = filter.getQueryParams().get("startTs");
    String endTsFilter = filter.getQueryParams().get("endTs");
    String service = filter.getQueryParams().get("service");
    String serviceType = filter.getQueryParams().get("serviceType");
    String tier = filter.getQueryParams().get("tier");

    // Convert domain and owner to IDs for database filtering
    String domain = filter.getQueryParams().get("domain");
    String domainId = domain != null ? resolveDomainToId(domain) : null;

    String owner = filter.getQueryParams().get("owner");
    String ownerId = owner != null ? resolveOwnerToId(owner) : null;

    // Build filter strings for database query
    String serviceFilterSql = buildServiceFilter(service);

    // Build database-specific serviceType filters
    String mysqlServiceTypeFilter =
        serviceType != null
            ? "AND JSON_UNQUOTE(JSON_EXTRACT(pe.json, '$.serviceType')) = '" + serviceType + "'"
            : "";
    String postgresServiceTypeFilter =
        serviceType != null ? "AND pe.json->>'serviceType' = '" + serviceType + "'" : "";

    String domainFilterSql =
        domainId != null
            ? "AND pe.id IN (SELECT toId FROM entity_relationship WHERE fromId = '"
                + domainId
                + "' AND relation = 10 AND toEntity = 'pipeline')"
            : "";
    String ownerFilterSql =
        ownerId != null
            ? "AND pe.id IN (SELECT toId FROM entity_relationship WHERE fromId = '"
                + ownerId
                + "' AND relation IN (8,1) AND toEntity = 'pipeline')"
            : "";

    // Build tier filter using tag_usage table (works on both MySQL and PostgreSQL)
    String tierFilterSql =
        tier != null
            ? "AND EXISTS (SELECT 1 FROM tag_usage tu WHERE tu.targetFQNHash = pe.fqnHash AND tu.tagFQN = '"
                + tier.replace("'", "''")
                + "')"
            : "";

    // Parse timestamp filters
    Long startTs = null;
    Long endTs = null;
    try {
      if (startTsFilter != null && !startTsFilter.isEmpty()) {
        startTs = Long.parseLong(startTsFilter);
      }
      if (endTsFilter != null && !endTsFilter.isEmpty()) {
        endTs = Long.parseLong(endTsFilter);
      }
    } catch (NumberFormatException e) {
      LOG.warn("Invalid timestamp filter value: {}", e.getMessage());
    }

    // Calculate offset for pagination
    int offset = 0;
    if (after != null && !after.isEmpty()) {
      try {
        String decodedAfter = RestUtil.decodeCursor(after);
        offset = Integer.parseInt(decodedAfter);
      } catch (Exception e) {
        LOG.warn("Invalid after cursor: {}", after);
      }
    }

    // Build MySQL-specific status filter
    String mysqlStatusFilter = "";
    if (statusFilter != null && (startTs != null || endTs != null)) {
      // Case 1: Status + timestamps = check latest status in time range
      mysqlStatusFilter =
          "AND (SELECT JSON_UNQUOTE(JSON_EXTRACT(eets_filter.json, '$.executionStatus')) "
              + "FROM entity_extension_time_series eets_filter "
              + "WHERE eets_filter.entityFQNHash = pe.fqnHash "
              + "  AND eets_filter.extension = 'pipeline.pipelineStatus' ";
      if (startTs != null) {
        mysqlStatusFilter += "  AND eets_filter.timestamp >= " + startTs + " ";
      }
      if (endTs != null) {
        mysqlStatusFilter += "  AND eets_filter.timestamp <= " + endTs + " ";
      }
      mysqlStatusFilter +=
          "ORDER BY eets_filter.timestamp DESC LIMIT 1) = '"
              + statusFilter.replace("'", "''")
              + "'";
    } else if (statusFilter != null) {
      // Case 2: Status only = check overall latest status
      mysqlStatusFilter =
          "AND (SELECT JSON_UNQUOTE(JSON_EXTRACT(eets_filter.json, '$.executionStatus')) "
              + "FROM entity_extension_time_series eets_filter "
              + "WHERE eets_filter.entityFQNHash = pe.fqnHash "
              + "  AND eets_filter.extension = 'pipeline.pipelineStatus' "
              + "ORDER BY eets_filter.timestamp DESC LIMIT 1) = '"
              + statusFilter.replace("'", "''")
              + "'";
    } else if (startTs != null || endTs != null) {
      // Case 3: Timestamps only = check if pipeline ran in time range
      mysqlStatusFilter =
          "AND EXISTS (SELECT 1 FROM entity_extension_time_series eets_filter "
              + "WHERE eets_filter.entityFQNHash = pe.fqnHash "
              + "  AND eets_filter.extension = 'pipeline.pipelineStatus' ";
      if (startTs != null) {
        mysqlStatusFilter += "  AND eets_filter.timestamp >= " + startTs + " ";
      }
      if (endTs != null) {
        mysqlStatusFilter += "  AND eets_filter.timestamp <= " + endTs + " ";
      }
      mysqlStatusFilter += ")";
    }

    // Build PostgreSQL-specific status filter
    String postgresStatusFilter = "";
    if (statusFilter != null && (startTs != null || endTs != null)) {
      // Case 1: Status + timestamps = check latest status in time range
      postgresStatusFilter =
          "AND (SELECT eets_filter.json->>'executionStatus' "
              + "FROM entity_extension_time_series eets_filter "
              + "WHERE eets_filter.entityFQNHash = pe.fqnHash "
              + "  AND eets_filter.extension = 'pipeline.pipelineStatus' ";
      if (startTs != null) {
        postgresStatusFilter += "  AND eets_filter.timestamp >= " + startTs + " ";
      }
      if (endTs != null) {
        postgresStatusFilter += "  AND eets_filter.timestamp <= " + endTs + " ";
      }
      postgresStatusFilter +=
          "ORDER BY eets_filter.timestamp DESC LIMIT 1) = '"
              + statusFilter.replace("'", "''")
              + "'";
    } else if (statusFilter != null) {
      // Case 2: Status only = check overall latest status
      postgresStatusFilter =
          "AND (SELECT eets_filter.json->>'executionStatus' "
              + "FROM entity_extension_time_series eets_filter "
              + "WHERE eets_filter.entityFQNHash = pe.fqnHash "
              + "  AND eets_filter.extension = 'pipeline.pipelineStatus' "
              + "ORDER BY eets_filter.timestamp DESC LIMIT 1) = '"
              + statusFilter.replace("'", "''")
              + "'";
    } else if (startTs != null || endTs != null) {
      // Case 3: Timestamps only = check if pipeline ran in time range
      postgresStatusFilter =
          "AND EXISTS (SELECT 1 FROM entity_extension_time_series eets_filter "
              + "WHERE eets_filter.entityFQNHash = pe.fqnHash "
              + "  AND eets_filter.extension = 'pipeline.pipelineStatus' ";
      if (startTs != null) {
        postgresStatusFilter += "  AND eets_filter.timestamp >= " + startTs + " ";
      }
      if (endTs != null) {
        postgresStatusFilter += "  AND eets_filter.timestamp <= " + endTs + " ";
      }
      postgresStatusFilter += ")";
    }

    // Call database-level filtered query
    List<CollectionDAO.PipelineSummaryRow> rows =
        daoCollection
            .entityExtensionTimeSeriesDao()
            .listPipelineSummariesFiltered(
                serviceFilterSql,
                mysqlServiceTypeFilter,
                postgresServiceTypeFilter,
                domainFilterSql,
                ownerFilterSql,
                tierFilterSql,
                mysqlStatusFilter,
                postgresStatusFilter,
                searchFilter,
                limit,
                offset);

    // Get total count for pagination
    int total =
        daoCollection
            .entityExtensionTimeSeriesDao()
            .countPipelineSummariesFiltered(
                serviceFilterSql,
                mysqlServiceTypeFilter,
                postgresServiceTypeFilter,
                domainFilterSql,
                ownerFilterSql,
                tierFilterSql,
                mysqlStatusFilter,
                postgresStatusFilter,
                searchFilter);

    // Convert rows to Pipeline objects and build summaries
    List<PipelineSummary> summaries = new ArrayList<>();
    for (CollectionDAO.PipelineSummaryRow row : rows) {
      try {
        // Parse pipeline JSON
        Pipeline pipeline = JsonUtils.readValue(row.getJson(), Pipeline.class);

        // Parse and attach latest status if available
        if (row.getLatestStatus() != null && !row.getLatestStatus().isEmpty()) {
          PipelineStatus status = JsonUtils.readValue(row.getLatestStatus(), PipelineStatus.class);
          pipeline.setPipelineStatus(status);
        }

        // Build summary
        PipelineSummary summary = buildPipelineSummary(pipeline);
        summaries.add(summary);
      } catch (Exception e) {
        LOG.error("Failed to build summary for pipeline from row: {}", e.getMessage());
      }
    }

    // Calculate pagination cursors
    // Note: ResultList constructor handles Base64 encoding, so pass raw offset strings
    String beforeCursor = null;
    String afterCursor = null;

    if (offset > 0) {
      beforeCursor = String.valueOf(Math.max(0, offset - limit));
    }

    if (offset + summaries.size() < total) {
      afterCursor = String.valueOf(offset + limit);
    }

    return new ResultList<>(summaries, beforeCursor, afterCursor, total);
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

    List<String> impactedAssetsFqns = getImpactedAssetsFqns(pipeline.getFullyQualifiedName());
    summary.setImpactedAssetsCount(impactedAssetsFqns.size());
    summary.setImpactedAssets(impactedAssetsFqns);

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
        .withImpactedAssetsCount(0)
        .withImpactedAssets(Collections.emptyList());
  }

  private Double calculateAverageRuntime(String pipelineFqn) {
    if (nullOrEmpty(pipelineFqn)) {
      return null;
    }

    try {
      long thirtyDaysAgo = System.currentTimeMillis() - (30L * 24 * 60 * 60 * 1000);
      long now = System.currentTimeMillis();

      List<PipelineStatus> statuses =
          JsonUtils.readObjects(
              getResultsFromAndToTimestamps(
                  pipelineFqn, PIPELINE_STATUS_EXTENSION, thirtyDaysAgo, now),
              PipelineStatus.class);

      if (statuses == null || statuses.isEmpty()) {
        return null;
      }

      List<Double> runtimes = new ArrayList<>();

      for (PipelineStatus status : statuses) {
        Double runtime = null;

        if (status.getTaskStatus() != null && !status.getTaskStatus().isEmpty()) {
          Long minStart = null;
          Long maxEnd = null;

          for (org.openmetadata.schema.type.Status task : status.getTaskStatus()) {
            if (task.getStartTime() != null && task.getEndTime() != null) {
              if (minStart == null || task.getStartTime() < minStart) {
                minStart = task.getStartTime();
              }
              if (maxEnd == null || task.getEndTime() > maxEnd) {
                maxEnd = task.getEndTime();
              }
            }
          }

          if (minStart != null && maxEnd != null) {
            runtime = (double) (maxEnd - minStart);
          }
        }

        if (runtime == null && status.getEndTime() != null && status.getTimestamp() != null) {
          runtime = (double) (status.getEndTime() - status.getTimestamp());
        }

        if (runtime != null && runtime > 0) {
          runtimes.add(runtime);
        }
      }

      if (runtimes.isEmpty()) {
        return null;
      }

      return runtimes.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);

    } catch (Exception e) {
      LOG.warn(
          "Failed to calculate average runtime for pipeline {}: {}", pipelineFqn, e.getMessage());
      return null;
    }
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

  public PipelineMetrics getPipelineMetrics(
      String query,
      String service,
      String serviceType,
      String status,
      String domain,
      String owner,
      String tier,
      Long startTs,
      Long endTs) {
    try {
      return getPipelineMetricsFromDB(
          query, service, serviceType, status, domain, owner, tier, startTs, endTs);
    } catch (Exception e) {
      LOG.warn("Failed to get metrics from database: {}", e.getMessage());
      return createEmptyMetrics("Database unavailable: " + e.getMessage());
    }
  }

  private PipelineMetrics getPipelineMetricsFromDB(
      String query,
      String service,
      String serviceType,
      String status,
      String domain,
      String owner,
      String tier,
      Long startTs,
      Long endTs) {
    try {
      String serviceFilter = buildServiceFilter(service);
      String serviceTypeFilter = buildServiceTypeFilter(serviceType);
      String mysqlStatusFilter = buildMysqlStatusFilter(status);
      String postgresStatusFilter = buildPostgresStatusFilter(status);
      String domainFilter = buildDomainFilter(domain);
      String ownerFilter = buildOwnerFilter(owner);
      String tierFilter = buildTierFilter(tier);
      String startTsFilter = buildStartTsFilter(startTs);
      String endTsFilter = buildEndTsFilter(endTs);

      CollectionDAO.PipelineMetricsRow metricsRow =
          daoCollection
              .entityExtensionTimeSeriesDao()
              .getPipelineMetricsData(
                  serviceTypeFilter,
                  serviceFilter,
                  mysqlStatusFilter,
                  postgresStatusFilter,
                  domainFilter,
                  ownerFilter,
                  tierFilter,
                  startTsFilter,
                  endTsFilter);
      List<CollectionDAO.ServiceBreakdownRow> serviceRows =
          daoCollection
              .entityExtensionTimeSeriesDao()
              .getServiceBreakdown(
                  serviceTypeFilter,
                  serviceFilter,
                  mysqlStatusFilter,
                  postgresStatusFilter,
                  domainFilter,
                  ownerFilter,
                  tierFilter,
                  startTsFilter,
                  endTsFilter);

      PipelineMetrics metrics = new PipelineMetrics();
      metrics.setDataAvailable(true);

      metrics.setTotalPipelines(metricsRow.getTotalPipelines());
      metrics.setActivePipelines(metricsRow.getActivePipelines());
      metrics.setSuccessfulPipelines(metricsRow.getSuccessfulPipelines());
      metrics.setFailedPipelines(metricsRow.getFailedPipelines());
      metrics.setInactivePipelines(
          metricsRow.getTotalPipelines() - metricsRow.getActivePipelines());
      metrics.setPipelinesWithoutStatus(metrics.getInactivePipelines());

      List<ServiceBreakdown> breakdowns = new ArrayList<>();
      metrics.setServiceCount(serviceRows.size());
      for (CollectionDAO.ServiceBreakdownRow row : serviceRows) {
        ServiceBreakdown breakdown = new ServiceBreakdown();
        breakdown.setServiceType(row.getServiceType());
        breakdown.setCount(row.getPipelineCount());
        breakdowns.add(breakdown);
      }
      metrics.setServiceBreakdown(breakdowns);

      return metrics;
    } catch (Exception e) {
      LOG.error("Failed to get pipeline metrics from database: {}", e.getMessage(), e);
      throw new RuntimeException("Failed to get pipeline metrics", e);
    }
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
      String service,
      String serviceType,
      String status,
      String domain,
      String owner,
      String tier,
      Integer limit,
      Integer offset) {
    try {
      return getPipelineExecutionTrendFromDB(
          startTs,
          endTs,
          pipelineFqn,
          service,
          serviceType,
          status,
          domain,
          owner,
          tier,
          limit,
          offset);
    } catch (Exception e) {
      LOG.warn("Failed to get execution trend from database: {}", e.getMessage());
      return createEmptyExecutionTrend("Database unavailable: " + e.getMessage());
    }
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

  private PipelineExecutionTrendList getPipelineExecutionTrendFromDB(
      Long startTs,
      Long endTs,
      String pipelineFqn,
      String service,
      String serviceType,
      String status,
      String domain,
      String owner,
      String tier,
      Integer limit,
      Integer offset) {
    try {
      String pipelineFqnFilter = buildPipelineFqnFilter(pipelineFqn);
      String serviceFilter = buildServiceFilter(service);
      String serviceTypeFilter = buildServiceTypeFilter(serviceType);
      String mysqlStatusFilter = buildMysqlStatusFilter(status);
      String postgresStatusFilter = buildPostgresStatusFilter(status);
      String domainFilter = buildDomainFilter(domain);
      String ownerFilter = buildOwnerFilter(owner);
      String tierFilter = buildTierFilter(tier);

      List<CollectionDAO.ExecutionTrendRow> rows =
          daoCollection
              .entityExtensionTimeSeriesDao()
              .getExecutionTrendData(
                  startTs,
                  endTs,
                  pipelineFqnFilter,
                  serviceTypeFilter,
                  serviceFilter,
                  mysqlStatusFilter,
                  postgresStatusFilter,
                  domainFilter,
                  ownerFilter,
                  tierFilter);

      Map<String, PipelineExecutionTrend> trendMap = new HashMap<>();
      int totalSuccess = 0, totalFailed = 0, totalExecutions = 0;

      for (CollectionDAO.ExecutionTrendRow row : rows) {
        PipelineExecutionTrend trend =
            trendMap.computeIfAbsent(
                row.getDateKey(),
                k -> {
                  PipelineExecutionTrend t = new PipelineExecutionTrend();
                  t.setDate(k);
                  t.setTimestamp(parseTimestampFromDate(k));
                  return t;
                });

        String executionStatus = row.getStatus() != null ? row.getStatus().toLowerCase() : "";
        int count = row.getCount();

        switch (executionStatus) {
          case "successful":
            trend.setSuccessCount(count);
            totalSuccess += count;
            break;
          case "failed":
            trend.setFailedCount(count);
            totalFailed += count;
            break;
          case "pending":
            trend.setPendingCount(count);
            break;
          case "skipped":
            trend.setSkippedCount(count);
            break;
          case "running":
            trend.setRunningCount(count);
            break;
        }
        totalExecutions += count;
      }

      List<PipelineExecutionTrend> trends = new ArrayList<>(trendMap.values());
      trends.forEach(
          t ->
              t.setTotalCount(
                  (t.getSuccessCount() != null ? t.getSuccessCount() : 0)
                      + (t.getFailedCount() != null ? t.getFailedCount() : 0)
                      + (t.getPendingCount() != null ? t.getPendingCount() : 0)
                      + (t.getSkippedCount() != null ? t.getSkippedCount() : 0)
                      + (t.getRunningCount() != null ? t.getRunningCount() : 0)));

      trends.sort(Comparator.comparing(PipelineExecutionTrend::getTimestamp));

      int total = trends.size();
      int fromIndex = Math.min(offset != null ? offset : 0, total);
      int toIndex = Math.min(fromIndex + (limit != null ? limit : 30), total);
      List<PipelineExecutionTrend> paginatedTrends = trends.subList(fromIndex, toIndex);

      PipelineExecutionTrendList trendList = new PipelineExecutionTrendList();
      trendList.setData(paginatedTrends);
      trendList.setTotalSuccessful(totalSuccess);
      trendList.setTotalFailed(totalFailed);
      trendList.setTotalExecutions(totalExecutions);
      trendList.setStartDate(java.time.Instant.ofEpochMilli(startTs).toString());
      trendList.setEndDate(java.time.Instant.ofEpochMilli(endTs).toString());
      trendList.setDataAvailable(!paginatedTrends.isEmpty());

      String before =
          fromIndex > 0
              ? String.valueOf(Math.max(0, fromIndex - (limit != null ? limit : 30)))
              : null;
      String after = toIndex < total ? String.valueOf(toIndex) : null;
      trendList.setPaging(
          new org.openmetadata.schema.type.Paging()
              .withBefore(before)
              .withAfter(after)
              .withTotal(total));

      return trendList;
    } catch (Exception e) {
      LOG.error("Failed to get execution trend from database: {}", e.getMessage(), e);
      throw new RuntimeException("Failed to get execution trend", e);
    }
  }

  private Long parseTimestampFromDate(String dateStr) {
    try {
      java.time.LocalDate date = java.time.LocalDate.parse(dateStr);
      return date.atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli();
    } catch (Exception e) {
      LOG.warn("Failed to parse date {}: {}", dateStr, e.getMessage());
      return System.currentTimeMillis();
    }
  }

  public PipelineRuntimeTrendList getPipelineRuntimeTrend(
      Long startTs,
      Long endTs,
      String pipelineFqn,
      String service,
      String serviceType,
      String status,
      String domain,
      String owner,
      String tier,
      Integer limit,
      Integer offset) {
    try {
      return getPipelineRuntimeTrendFromDB(
          startTs,
          endTs,
          pipelineFqn,
          service,
          serviceType,
          status,
          domain,
          owner,
          tier,
          limit,
          offset);
    } catch (Exception e) {
      LOG.warn("Failed to get runtime trend from database: {}", e.getMessage());
      return createEmptyRuntimeTrend("Database unavailable: " + e.getMessage());
    }
  }

  private PipelineRuntimeTrendList createEmptyRuntimeTrend(String errorMessage) {
    return new PipelineRuntimeTrendList()
        .withData(new ArrayList<>())
        .withDataAvailable(false)
        .withErrorMessage(errorMessage);
  }

  private PipelineRuntimeTrendList getPipelineRuntimeTrendFromDB(
      Long startTs,
      Long endTs,
      String pipelineFqn,
      String service,
      String serviceType,
      String status,
      String domain,
      String owner,
      String tier,
      Integer limit,
      Integer offset) {
    try {
      String pipelineFqnFilter = buildPipelineFqnFilter(pipelineFqn);
      String serviceFilter = buildServiceFilter(service);
      String serviceTypeFilter = buildServiceTypeFilter(serviceType);
      String mysqlStatusFilter = buildMysqlStatusFilter(status);
      String postgresStatusFilter = buildPostgresStatusFilter(status);
      String domainFilter = buildDomainFilter(domain);
      String ownerFilter = buildOwnerFilter(owner);
      String tierFilter = buildTierFilter(tier);

      List<CollectionDAO.RuntimeTrendRow> rows =
          daoCollection
              .entityExtensionTimeSeriesDao()
              .getRuntimeTrendData(
                  startTs,
                  endTs,
                  pipelineFqnFilter,
                  serviceTypeFilter,
                  serviceFilter,
                  mysqlStatusFilter,
                  postgresStatusFilter,
                  domainFilter,
                  ownerFilter,
                  tierFilter);

      List<PipelineRuntimeTrend> trends = new ArrayList<>();
      for (CollectionDAO.RuntimeTrendRow row : rows) {
        PipelineRuntimeTrend trend = new PipelineRuntimeTrend();
        trend.setDate(row.getDateKey());
        trend.setTimestamp(row.getFirstTimestamp());
        trend.setMaxRuntime(row.getMaxRuntime() != null ? row.getMaxRuntime() : 0.0);
        trend.setMinRuntime(row.getMinRuntime() != null ? row.getMinRuntime() : 0.0);
        trend.setAvgRuntime(row.getAvgRuntime() != null ? row.getAvgRuntime() : 0.0);
        trend.setTotalPipelines(row.getTotalPipelines() != null ? row.getTotalPipelines() : 0);
        trends.add(trend);
      }

      int total = trends.size();
      int fromIndex = Math.min(offset != null ? offset : 0, total);
      int toIndex = Math.min(fromIndex + (limit != null ? limit : 30), total);
      List<PipelineRuntimeTrend> paginatedTrends = trends.subList(fromIndex, toIndex);

      PipelineRuntimeTrendList trendList = new PipelineRuntimeTrendList();
      trendList.setData(paginatedTrends);
      trendList.setStartDate(java.time.Instant.ofEpochMilli(startTs).toString());
      trendList.setEndDate(java.time.Instant.ofEpochMilli(endTs).toString());
      trendList.setDataAvailable(!paginatedTrends.isEmpty());

      String before =
          fromIndex > 0
              ? String.valueOf(Math.max(0, fromIndex - (limit != null ? limit : 30)))
              : null;
      String after = toIndex < total ? String.valueOf(toIndex) : null;
      trendList.setPaging(
          new org.openmetadata.schema.type.Paging()
              .withBefore(before)
              .withAfter(after)
              .withTotal(total));

      return trendList;
    } catch (Exception e) {
      LOG.error("Failed to get runtime trend from database: {}", e.getMessage(), e);
      throw new RuntimeException("Failed to get runtime trend", e);
    }
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

  private String buildPipelineFqnFilter(String pipelineFqn) {
    if (pipelineFqn != null && !pipelineFqn.isEmpty()) {
      String fqnHash = FullyQualifiedName.buildHash(pipelineFqn);
      return "AND pe.fqnHash = '" + fqnHash + "'";
    }
    return "";
  }

  private String buildServiceTypeFilter(String serviceType) {
    if (serviceType != null && !serviceType.isEmpty()) {
      String safeServiceType = serviceType.replace("'", "''");
      String filter =
          "AND JSON_UNQUOTE(JSON_EXTRACT(pe.json, '$.serviceType')) = '" + safeServiceType + "'";
      LOG.debug("buildServiceTypeFilter: input='{}', filter='{}'", serviceType, filter);
      return filter;
    }
    LOG.debug("buildServiceTypeFilter: returning empty filter (serviceType was null or empty)");
    return "";
  }

  private String buildMysqlStatusFilter(String status) {
    if (status != null && !status.isEmpty()) {
      String safeStatus = status.replace("'", "''");
      return "AND eets.json IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(eets.json, '$.executionStatus')) = '"
          + safeStatus
          + "'";
    }
    return "";
  }

  private String buildPostgresStatusFilter(String status) {
    if (status != null && !status.isEmpty()) {
      String safeStatus = status.replace("'", "''");
      return "AND eets.json IS NOT NULL AND eets.json->>'executionStatus' = '" + safeStatus + "'";
    }
    return "";
  }

  private boolean isValidUUID(String value) {
    try {
      UUID.fromString(value);
      return true;
    } catch (IllegalArgumentException e) {
      return false;
    }
  }

  private String resolveDomainToId(String domain) {
    if (isValidUUID(domain)) {
      return domain;
    }
    try {
      EntityReference domainRef =
          Entity.getEntityReferenceByName(Entity.DOMAIN, domain, Include.NON_DELETED);
      return domainRef.getId().toString();
    } catch (Exception e) {
      LOG.warn("Could not resolve domain '{}' to ID: {}", domain, e.getMessage());
      return null;
    }
  }

  private String resolveOwnerToId(String owner) {
    if (isValidUUID(owner)) {
      return owner;
    }
    try {
      EntityReference ownerRef =
          Entity.getEntityReferenceByName(Entity.USER, owner, Include.NON_DELETED);
      return ownerRef.getId().toString();
    } catch (Exception e) {
      try {
        EntityReference teamRef =
            Entity.getEntityReferenceByName(Entity.TEAM, owner, Include.NON_DELETED);
        return teamRef.getId().toString();
      } catch (Exception e2) {
        LOG.warn("Could not resolve owner '{}' to ID: {}", owner, e2.getMessage());
        return null;
      }
    }
  }

  private String buildDomainFilter(String domain) {
    if (domain != null && !domain.isEmpty()) {
      String domainId = resolveDomainToId(domain);
      if (domainId == null) {
        return "";
      }
      return "AND EXISTS (SELECT 1 FROM entity_relationship er "
          + "WHERE er.toId = pe.id AND er.toEntity = 'pipeline' "
          + "AND er.fromEntity = 'domain' AND er.relation = 10 "
          + "AND er.fromId = '"
          + domainId
          + "')";
    }
    return "";
  }

  private String buildOwnerFilter(String owner) {
    if (owner != null && !owner.isEmpty()) {
      String ownerId = resolveOwnerToId(owner);
      if (ownerId == null) {
        return "";
      }
      return "AND EXISTS (SELECT 1 FROM entity_relationship er "
          + "WHERE er.toId = pe.id AND er.toEntity = 'pipeline' "
          + "AND er.fromEntity IN ('user', 'team') AND er.relation = 8 "
          + "AND er.fromId = '"
          + ownerId
          + "')";
    }
    return "";
  }

  private String buildTierFilter(String tier) {
    if (tier != null && !tier.isEmpty()) {
      String safeTier = tier.replace("'", "''");
      return "AND EXISTS (SELECT 1 FROM tag_usage tu "
          + "WHERE tu.targetFQNHash = pe.fqnHash "
          + "AND tu.tagFQN = '"
          + safeTier
          + "')";
    }
    return "";
  }

  private String buildServiceFilter(String service) {
    if (service != null && !service.isEmpty()) {
      String safeService = service.replace("'", "''");
      return "AND EXISTS (SELECT 1 FROM entity_relationship er "
          + "JOIN pipeline_service_entity pse ON er.fromId = pse.id "
          + "WHERE er.toId = pe.id "
          + "AND er.fromEntity = 'pipelineService' "
          + "AND er.toEntity = 'pipeline' "
          + "AND er.relation = 0 "
          + "AND pse.name = '"
          + safeService
          + "')";
    }
    LOG.debug("buildServiceFilter: returning empty filter (service was null or empty)");
    return "";
  }

  private String buildStartTsFilter(Long startTs) {
    if (startTs != null) {
      return "AND eets.timestamp IS NOT NULL AND eets.timestamp >= " + startTs;
    }
    return "";
  }

  private String buildEndTsFilter(Long endTs) {
    if (endTs != null) {
      return "AND eets.timestamp IS NOT NULL AND eets.timestamp <= " + endTs;
    }
    return "";
  }

  private List<String> getImpactedAssetsFqns(String pipelineFqn) {
    if (nullOrEmpty(pipelineFqn)) {
      return Collections.emptyList();
    }

    try {
      String extensionKey = "table.pipelineObservability." + pipelineFqn;
      List<CollectionDAO.ExtensionWithIdAndSchemaObject> records =
          daoCollection.entityExtensionDAO().getExtensionsByPrefixBatch(extensionKey);

      // Get unique table IDs
      Set<String> uniqueTableIds = new HashSet<>();
      for (CollectionDAO.ExtensionWithIdAndSchemaObject record : records) {
        uniqueTableIds.add(record.getId());
      }

      // Convert table IDs to FQNs
      List<String> tableFqns = new ArrayList<>();
      for (String tableId : uniqueTableIds) {
        try {
          EntityReference tableRef =
              Entity.getEntityReferenceById(Entity.TABLE, UUID.fromString(tableId), NON_DELETED);
          if (tableRef != null && tableRef.getFullyQualifiedName() != null) {
            tableFqns.add(tableRef.getFullyQualifiedName());
          }
        } catch (Exception e) {
          LOG.debug(
              "Skipping table {} for pipeline '{}': {}", tableId, pipelineFqn, e.getMessage());
        }
      }

      return tableFqns;

    } catch (Exception e) {
      LOG.error(
          "Failed to get impacted assets FQNs for pipeline '{}': {}", pipelineFqn, e.getMessage());
      return Collections.emptyList();
    }
  }
}
