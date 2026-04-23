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
import static org.openmetadata.service.Entity.METRIC;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;

import jakarta.json.JsonPatch;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.ResultList;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.metrics.MetricMapper;
import org.openmetadata.service.resources.metrics.MetricResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;
import org.openmetadata.service.search.SearchListFilter;

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
    fieldFetchers.put("metricGroup", this::fetchAndSetMetricGroup);
  }

  private void fetchAndSetMetricGroup(List<Metric> metrics, EntityUtil.Fields fields) {
    if (!fields.contains("metricGroup") || metrics == null || metrics.isEmpty()) {
      return;
    }
    for (Metric metric : metrics) {
      if (metric.getMetricGroup() == null || metric.getMetricGroup().getId() == null) {
        continue;
      }
      EntityReference groupRef = Entity.getEntityReferenceById(
          METRIC,
          metric.getMetricGroup().getId(),
          Include.NON_DELETED);
      metric.setMetricGroup(groupRef);
    }
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
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of("relatedMetrics");
  }

  @Override
  public void storeEntity(Metric metric, boolean update) {
    store(metric, update);
  }

  @Override
  public void storeEntities(List<Metric> entities) {
    storeMany(entities);
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
      if (original.getReviewers() != null
          && updated.getReviewers() != null
          && !original.getReviewers().equals(updated.getReviewers())) {
        updateTaskWithNewReviewers(updated);
      }
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate(
          "granularity",
          () -> recordChange("granularity", original.getGranularity(), updated.getGranularity()));
      compareAndUpdate(
          "metricType",
          () -> recordChange("metricType", original.getMetricType(), updated.getMetricType()));
      compareAndUpdate(
          "unitOfMeasurement",
          () ->
              recordChange(
                  "unitOfMeasurement",
                  original.getUnitOfMeasurement(),
                  updated.getUnitOfMeasurement()));
      compareAndUpdate(
          "customUnitOfMeasurement",
          () ->
              recordChange(
                  "customUnitOfMeasurement",
                  original.getCustomUnitOfMeasurement(),
                  updated.getCustomUnitOfMeasurement()));
      compareAndUpdate(
          "metricExpression",
          () -> {
            if (updated.getMetricExpression() != null) {
              recordChange(
                  "metricExpression",
                  original.getMetricExpression(),
                  updated.getMetricExpression());
            }
          });
      compareAndUpdate("relatedMetrics", () -> updateRelatedMetrics(original, updated));
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
    if (original.getEntityStatus() != EntityStatus.DRAFT
        && updated.getEntityStatus() == EntityStatus.DRAFT) {
      try {
        closeApprovalTask(updated, "Closed due to metric going back to DRAFT.");
      } catch (EntityNotFoundException ignored) {
        // No ApprovalTask is present, so we don't need to worry about this.
      }
    }
  }

  @Override
  protected void preDelete(Metric entity, String deletedBy) {
    if (EntityStatus.IN_REVIEW.equals(entity.getEntityStatus())) {
      checkUpdatedByReviewer(entity, deletedBy);
    }
  }

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
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

  public List<Metric> exportMetricsList(Fields fields, SearchListFilter searchListFilter) {
    List<Metric> allMetrics = new ArrayList<>();
    int offset = 0;
    int batchSize = 1000;
    ResultList<Metric> batch;
    try {
      do {
        batch = listFromSearchWithOffset(
            null,
            fields,
            searchListFilter,
            batchSize,
            offset,
            null,
            null,
            null,
            null);
        if (batch.getData() != null) {
          allMetrics.addAll(batch.getData());
        }
        offset += batchSize;
      } while (batch.getData() != null && batch.getData().size() == batchSize);
    } catch (IOException e) {
      throw new RuntimeException("Failed to export metrics", e);
    }
    return allMetrics;
  }

  public Response importMetrics(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String csvData) {
    if (csvData == null || csvData.trim().isEmpty()) {
      throw new IllegalArgumentException("CSV data cannot be empty");
    }

    String[] lines = csvData.split("\n");
    if (lines.length < 2) {
      throw new IllegalArgumentException("CSV must have at least a header and one data row");
    }

    List<CreateMetric> createdMetrics = new ArrayList<>();
    String[] headers = parseCsvLine(lines[0].trim());

    for (int i = 1; i < lines.length; i++) {
      String line = lines[i].trim();
      if (line.isEmpty()) continue;

      String[] values = parseCsvLine(line);
      if (values.length < headers.length) {
        LOG.warn("Skipping row {} - insufficient columns", i);
        continue;
      }

      Map<String, String> rowData = new HashMap<>();
      for (int j = 0; j < headers.length; j++) {
        rowData.put(headers[j], j < values.length ? values[j] : "");
      }

      CreateMetric createMetric = new CreateMetric()
          .withName(rowData.getOrDefault("name", "").trim())
          .withDisplayName(rowData.get("displayName"))
          .withDescription(rowData.get("description"));

      if (!createMetric.getName().isEmpty()) {
        createdMetrics.add(createMetric);
      }
    }

    List<Metric> imported = new ArrayList<>();
    Map<Integer, String> failedImports = new HashMap<>();
    MetricMapper mapper = new MetricMapper();
    for (int i = 0; i < createdMetrics.size(); i++) {
      CreateMetric create = createdMetrics.get(i);
      try {
        Metric metric = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
        setFullyQualifiedName(metric);
        prepare(metric, false);
        storeEntity(metric, false);
        storeRelationships(metric);
        imported.add(metric);
      } catch (Exception e) {
        LOG.error("Failed to import metric: {}", create.getName(), e);
        failedImports.put(i + 1, e.getMessage());
      }
    }

    ResultList<Metric> list = new ResultList<>();
    list.setData(imported);
    list.setPaging(new Paging().withTotal(imported.size()));
    return Response.ok(list).build();
  }

  private String[] parseCsvLine(String line) {
    List<String> values = new ArrayList<>();
    StringBuilder current = new StringBuilder();
    boolean inQuotes = false;

    for (int i = 0; i < line.length(); i++) {
      char c = line.charAt(i);
      if (c == '"') {
        if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
          current.append('"');
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c == ',' && !inQuotes) {
        values.add(current.toString().trim());
        current = new StringBuilder();
      } else {
        current.append(c);
      }
    }
    values.add(current.toString().trim());
    return values.toArray(new String[0]);
  }

  public static class MetricsList extends ResultList<Metric> {}
}
