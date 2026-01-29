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
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.FIELD_ENTITY_STATUS;
import static org.openmetadata.service.Entity.METRIC;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;

import com.google.gson.Gson;
import jakarta.json.JsonPatch;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.metrics.MetricResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityFieldUtils;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
public class MetricRepository extends EntityRepository<Metric> {
  private static final String UPDATE_FIELDS = "relatedMetrics";
  private static final String PATCH_FIELDS = "relatedMetrics";

  public MetricRepository() {
    super(
        MetricResource.COLLECTION_PATH,
        Entity.METRIC,
        Metric.class,
        Entity.getCollectionDAO().metricDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
    renameAllowed = true;

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put("relatedMetrics", this::fetchAndSetRelatedMetrics);
  }

  @Override
  public void setFullyQualifiedName(Metric metric) {
    metric.setFullyQualifiedName(metric.getName());
  }

  @Override
  public void prepare(Metric metric, boolean update) {
    validateRelatedTerms(metric, metric.getRelatedMetrics());
    validateCustomUnitOfMeasurement(metric);
  }

  private void validateCustomUnitOfMeasurement(Metric metric) {
    MetricUnitOfMeasurement unitOfMeasurement = metric.getUnitOfMeasurement();
    String customUnit = metric.getCustomUnitOfMeasurement();

    if (unitOfMeasurement == MetricUnitOfMeasurement.OTHER) {
      if (CommonUtil.nullOrEmpty(customUnit)) {
        throw new IllegalArgumentException(
            "customUnitOfMeasurement is required when unitOfMeasurement is OTHER");
      }
      // Trim and normalize
      metric.setCustomUnitOfMeasurement(customUnit.trim());
    } else {
      // Clear custom unit if not OTHER to maintain consistency
      metric.setCustomUnitOfMeasurement(null);
    }
  }

  @Override
  public void setFields(
      Metric metric, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    metric.setRelatedMetrics(
        fields.contains("relatedMetrics") ? getRelatedMetrics(metric) : metric.getRelatedMetrics());
  }

  @Override
  protected void clearFields(Metric entity, EntityUtil.Fields fields) {
    entity.setRelatedMetrics(fields.contains("relatedMetrics") ? entity.getRelatedMetrics() : null);
  }

  // Individual field fetchers registered in constructor
  private void fetchAndSetRelatedMetrics(List<Metric> metrics, EntityUtil.Fields fields) {
    if (!fields.contains("relatedMetrics") || metrics == null || metrics.isEmpty()) {
      return;
    }
    // Use bulk relationship fetching for related metrics
    setFieldFromMap(true, metrics, batchFetchRelatedMetrics(metrics), Metric::setRelatedMetrics);
  }

  @Override
  public void storeEntity(Metric metric, boolean update) {
    List<EntityReference> relatedMetrics = metric.getRelatedMetrics();
    metric.setRelatedMetrics(null);
    store(metric, update);
    metric.setRelatedMetrics(relatedMetrics);
  }

  @Override
  public void storeEntities(List<Metric> entities) {
    List<Metric> entitiesToStore = new ArrayList<>();
    Gson gson = new Gson();

    for (Metric metric : entities) {
      List<EntityReference> relatedMetrics = metric.getRelatedMetrics();

      metric.setRelatedMetrics(null);

      String jsonCopy = gson.toJson(metric);
      entitiesToStore.add(gson.fromJson(jsonCopy, Metric.class));

      metric.setRelatedMetrics(relatedMetrics);
    }

    storeMany(entitiesToStore);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<Metric> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Metric::getId).toList();
    deleteFromMany(ids, Entity.METRIC, Relationship.RELATED_TO, Entity.METRIC);
    deleteToMany(ids, Entity.METRIC, Relationship.RELATED_TO, Entity.METRIC);
  }

  @Override
  public void storeRelationships(Metric metric) {
    // Nothing to do
    for (EntityReference relatedMetric : listOrEmpty(metric.getRelatedMetrics())) {
      addRelationship(
          metric.getId(), relatedMetric.getId(), METRIC, METRIC, Relationship.RELATED_TO, true);
    }
  }

  private List<EntityReference> getRelatedMetrics(Metric metric) {
    return findBoth(metric.getId(), METRIC, Relationship.RELATED_TO, METRIC);
  }

  @Override
  public EntityRepository<Metric>.EntityUpdater getUpdater(
      Metric original, Metric updated, Operation operation, ChangeSource changeSource) {
    return new MetricRepository.MetricUpdater(original, updated, operation);
  }

  private void validateRelatedTerms(Metric metric, List<EntityReference> relatedMetrics) {
    for (EntityReference relatedMetric : listOrEmpty(relatedMetrics)) {
      if (!relatedMetric.getType().equals(METRIC)) {
        throw new IllegalArgumentException(
            "Related metric " + relatedMetric.getId() + " is not a metric");
      }
      if (relatedMetric.getId().equals(metric.getId())) {
        throw new IllegalArgumentException(
            "Related metric " + relatedMetric.getId() + " cannot be the same as the metric");
      }
    }
  }

  public class MetricUpdater extends EntityUpdater {

    public MetricUpdater(Metric original, Metric updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void updateReviewers() {
      super.updateReviewers();
      // adding the reviewer should add the person as assignee to the task
      if (original.getReviewers() != null
          && updated.getReviewers() != null
          && !original.getReviewers().equals(updated.getReviewers())) {
        updateTaskWithNewReviewers(updated);
      }
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("granularity", original.getGranularity(), updated.getGranularity());
      recordChange("metricType", original.getMetricType(), updated.getMetricType());
      recordChange(
          "unitOfMeasurement", original.getUnitOfMeasurement(), updated.getUnitOfMeasurement());
      recordChange(
          "customUnitOfMeasurement",
          original.getCustomUnitOfMeasurement(),
          updated.getCustomUnitOfMeasurement());
      if (updated.getMetricExpression() != null) {
        recordChange(
            "metricExpression", original.getMetricExpression(), updated.getMetricExpression());
      }
      updateRelatedMetrics(original, updated);
    }

    private void updateRelatedMetrics(Metric original, Metric updated) {
      List<EntityReference> originalRelatedMetrics = listOrEmpty(original.getRelatedMetrics());
      List<EntityReference> updatedRelatedMetrics = listOrEmpty(updated.getRelatedMetrics());
      validateRelatedTerms(updated, updatedRelatedMetrics);
      updateToRelationships(
          "relatedMetrics",
          METRIC,
          original.getId(),
          Relationship.RELATED_TO,
          METRIC,
          originalRelatedMetrics,
          updatedRelatedMetrics,
          true);
    }
  }

  public List<String> getDistinctCustomUnitsOfMeasurement() {
    // Execute efficient database query to get distinct custom units
    return daoCollection.metricDAO().getDistinctCustomUnitsOfMeasurement();
  }

  private Map<UUID, List<EntityReference>> batchFetchRelatedMetrics(List<Metric> metrics) {
    Map<UUID, List<EntityReference>> relatedMetricsMap = new HashMap<>();
    if (metrics == null || metrics.isEmpty()) {
      return relatedMetricsMap;
    }

    // Initialize empty lists for all metrics
    for (Metric metric : metrics) {
      relatedMetricsMap.put(metric.getId(), new ArrayList<>());
    }

    // For bidirectional relationships, we need to fetch both directions
    // First, get relationships where these metrics are the source
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatch(entityListToStrings(metrics), Relationship.RELATED_TO.ordinal(), METRIC);

    // Group related metrics by source metric ID
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID metricId = UUID.fromString(record.getFromId());
      EntityReference relatedMetricRef =
          Entity.getEntityReferenceById(METRIC, UUID.fromString(record.getToId()), NON_DELETED);
      relatedMetricsMap.get(metricId).add(relatedMetricRef);
    }

    // Second, get relationships where these metrics are the target (bidirectional)
    List<CollectionDAO.EntityRelationshipObject> reverseRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(metrics), Relationship.RELATED_TO.ordinal());

    // Group related metrics by target metric ID
    for (CollectionDAO.EntityRelationshipObject record : reverseRecords) {
      UUID metricId = UUID.fromString(record.getToId());
      EntityReference relatedMetricRef =
          Entity.getEntityReferenceById(METRIC, UUID.fromString(record.getFromId()), NON_DELETED);
      relatedMetricsMap.get(metricId).add(relatedMetricRef);
    }

    return relatedMetricsMap;
  }

  @Override
  public void postUpdate(Metric original, Metric updated) {
    super.postUpdate(original, updated);
    if (original.getEntityStatus() == EntityStatus.IN_REVIEW) {
      if (updated.getEntityStatus() == EntityStatus.APPROVED) {
        closeApprovalTask(updated, "Approved the metric");
      } else if (updated.getEntityStatus() == EntityStatus.REJECTED) {
        closeApprovalTask(updated, "Rejected the metric");
      }
    }

    // Handle case where task goes from DRAFT to IN_REVIEW to DRAFT quickly
    // Due to ChangesConsolidation, the postUpdate will be called as from DRAFT to DRAFT,
    // but there will be a task created. This handles that case scenario.
    if (updated.getEntityStatus() == EntityStatus.DRAFT) {
      try {
        closeApprovalTask(updated, "Closed due to metric going back to DRAFT.");
      } catch (EntityNotFoundException ignored) {
        // No ApprovalTask is present, so we don't need to worry about this.
      }
    }
  }

  @Override
  protected void preDelete(Metric entity, String deletedBy) {
    // A metric in `IN_REVIEW` state can only be deleted by the reviewers
    if (EntityStatus.IN_REVIEW.equals(entity.getEntityStatus())) {
      checkUpdatedByReviewer(entity, deletedBy);
    }
  }

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    TaskType taskType = threadContext.getThread().getTask().getType();
    if (EntityUtil.isApprovalTask(taskType)) {
      return new ApprovalTaskWorkflow(threadContext);
    }
    return super.getTaskWorkflow(threadContext);
  }

  public static void checkUpdatedByReviewer(Metric metric, String updatedBy) {
    // Only list of allowed reviewers can change the status from DRAFT to APPROVED
    List<EntityReference> reviewers = metric.getReviewers();
    if (!nullOrEmpty(reviewers)) {
      // Updating user must be one of the reviewers
      boolean isReviewer =
          reviewers.stream()
              .anyMatch(
                  e -> {
                    if (e.getType().equals(TEAM)) {
                      Team team =
                          Entity.getEntityByName(TEAM, e.getName(), "users", Include.NON_DELETED);
                      return team.getUsers().stream()
                          .anyMatch(
                              u ->
                                  u.getName().equals(updatedBy)
                                      || u.getFullyQualifiedName().equals(updatedBy));
                    } else {
                      return e.getName().equals(updatedBy)
                          || e.getFullyQualifiedName().equals(updatedBy);
                    }
                  });
      if (!isReviewer) {
        throw new AuthorizationException(notReviewer(updatedBy));
      }
    }
  }

  private void closeApprovalTask(Metric entity, String comment) {
    EntityLink about = new EntityLink(METRIC, entity.getFullyQualifiedName());
    FeedRepository feedRepository = Entity.getFeedRepository();
    try {
      Thread taskThread = feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      feedRepository.closeTask(
          taskThread, entity.getUpdatedBy(), new CloseTask().withComment(comment));
    } catch (EntityNotFoundException ex) {
      LOG.info(
          "{} Task not found for metric {}",
          TaskType.RequestApproval,
          entity.getFullyQualifiedName());
    }
  }

  protected void updateTaskWithNewReviewers(Metric metric) {
    try {
      MessageParser.EntityLink about =
          new MessageParser.EntityLink(METRIC, metric.getFullyQualifiedName());
      FeedRepository feedRepository = Entity.getFeedRepository();
      Thread originalTask =
          feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      metric =
          Entity.getEntityByName(
              Entity.METRIC,
              metric.getFullyQualifiedName(),
              "id,fullyQualifiedName,reviewers",
              Include.ALL);

      Thread updatedTask = JsonUtils.deepCopy(originalTask, Thread.class);
      updatedTask.getTask().withAssignees(new ArrayList<>(metric.getReviewers()));
      JsonPatch patch = JsonUtils.getJsonPatch(originalTask, updatedTask);
      RestUtil.PatchResponse<Thread> thread =
          feedRepository.patchThread(null, originalTask.getId(), updatedTask.getUpdatedBy(), patch);

      // Send WebSocket Notification
      WebsocketNotificationHandler.handleTaskNotification(thread.entity());
    } catch (EntityNotFoundException e) {
      LOG.info(
          "{} Task not found for metric {}",
          TaskType.RequestApproval,
          metric.getFullyQualifiedName());
    }
  }

  public static class ApprovalTaskWorkflow extends TaskWorkflow {
    ApprovalTaskWorkflow(ThreadContext threadContext) {
      super(threadContext);
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      Metric metric = (Metric) threadContext.getAboutEntity();
      MetricRepository.checkUpdatedByReviewer(metric, user);

      UUID taskId = threadContext.getThread().getId();
      Map<String, Object> variables = new HashMap<>();
      variables.put(RESULT_VARIABLE, resolveTask.getNewValue().equalsIgnoreCase("approved"));
      variables.put(UPDATED_BY_VARIABLE, user);
      WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
      boolean workflowSuccess =
          workflowHandler.resolveTask(
              taskId, workflowHandler.transformToNodeVariables(taskId, variables));

      // If workflow failed (corrupted Flowable task), apply the status directly
      if (!workflowSuccess) {
        LOG.warn(
            "[GlossaryTerm] Workflow failed for taskId='{}', applying status directly", taskId);
        Boolean approved = (Boolean) variables.get(RESULT_VARIABLE);
        String entityStatus = (approved != null && approved) ? "Approved" : "Rejected";
        EntityFieldUtils.setEntityField(
            metric, METRIC, user, FIELD_ENTITY_STATUS, entityStatus, true);
      }

      return metric;
    }
  }
}
