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
import static org.openmetadata.csv.CsvUtil.addEntityReferences;
import static org.openmetadata.csv.CsvUtil.addExtension;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addGlossaryTerms;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.csv.CsvUtil.addReviewers;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.csv.CsvUtil.addTagTiers;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.METRIC;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetricExpressionLanguage;
import org.openmetadata.schema.type.MetricGranularity;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.metrics.MetricResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityFieldUtils;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.MemoryOwnership;

@Slf4j
public class MetricRepository extends EntityRepository<Metric> {
  private static final String UPDATE_FIELDS = "relatedMetrics";
  private static final String PATCH_FIELDS = "relatedMetrics";
  static final String FIELD_DERIVED_FROM = "derivedFrom";

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
    if (fields.contains(FIELD_DERIVED_FROM)) {
      metric.setDerivedFrom(getDerivedFrom(metric));
    }
  }

  @Override
  protected void clearFields(Metric entity, EntityUtil.Fields fields) {
    entity.setRelatedMetrics(fields.contains("relatedMetrics") ? entity.getRelatedMetrics() : null);
    if (!fields.contains(FIELD_DERIVED_FROM)) {
      entity.setDerivedFrom(null);
    }
  }

  /**
   * Returns the context memory from which the Memory Agent created this metric.
   * Edge direction: from=metric → to=memory via DERIVED_FROM; findTo resolves the to-side (memory).
   */
  private EntityReference getDerivedFrom(Metric metric) {
    final List<EntityReference> refs =
        findTo(metric.getId(), Entity.METRIC, Relationship.DERIVED_FROM, Entity.CONTEXT_MEMORY);
    return nullOrEmpty(refs) ? null : refs.getFirst();
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
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    return exportToCsv(name, user, recursive, null);
  }

  @Override
  public String exportToCsv(
      String name, String user, boolean recursive, CsvExportProgressCallback callback)
      throws IOException {
    List<Metric> metrics =
        "*".equals(name)
            ? listAll(getFields("*"), new ListFilter(NON_DELETED))
            : List.of(getByName(null, name, getFields("*")));
    return new MetricCsv(user).exportCsv(metrics, callback);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    return importFromCsv(name, csv, dryRun, user, recursive, (CsvImportProgressCallback) null);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name,
      String csv,
      boolean dryRun,
      String user,
      boolean recursive,
      CsvImportProgressCallback callback)
      throws IOException {
    return new MetricCsv(user).importCsv(csv, dryRun, callback);
  }

  @Override
  public boolean supportsBulkImportVersioning() {
    return false;
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

  public static class MetricCsv extends EntityCsv<Metric> {
    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(METRIC, false);
    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();

    MetricCsv(String user) {
      super(METRIC, HEADERS, user);
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      if (csvRecord == null) {
        return;
      }

      Metric metric =
          new Metric()
              .withName(csvRecord.get(0))
              .withDisplayName(csvRecord.get(1))
              .withDescription(csvRecord.get(2))
              .withMetricType(getMetricType(printer, csvRecord, 3))
              .withUnitOfMeasurement(getUnitOfMeasurement(printer, csvRecord, 4))
              .withCustomUnitOfMeasurement(csvRecord.get(5))
              .withGranularity(getGranularity(printer, csvRecord, 6))
              .withMetricExpression(getMetricExpression(printer, csvRecord))
              .withRelatedMetrics(getEntityReferences(printer, csvRecord, 9, METRIC))
              .withTags(
                  getTagLabels(
                      printer,
                      csvRecord,
                      List.of(
                          Pair.of(10, TagLabel.TagSource.CLASSIFICATION),
                          Pair.of(11, TagLabel.TagSource.GLOSSARY),
                          Pair.of(12, TagLabel.TagSource.CLASSIFICATION))))
              .withOwners(getOwners(printer, csvRecord, 13))
              .withReviewers(getReviewers(printer, csvRecord, 14))
              .withDomains(getDomains(printer, csvRecord, 15))
              .withDataProducts(getEntityReferences(printer, csvRecord, 16, Entity.DATA_PRODUCT))
              .withEntityStatus(getEntityStatus(printer, csvRecord, 17))
              .withExtension(getExtension(printer, csvRecord, 18));

      if (processRecord) {
        createEntity(printer, csvRecord, metric);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, Metric entity) {
      List<String> recordList = new ArrayList<>();
      MetricExpression expression = entity.getMetricExpression();

      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addField(recordList, entity.getMetricType() == null ? null : entity.getMetricType().value());
      addField(
          recordList,
          entity.getUnitOfMeasurement() == null ? null : entity.getUnitOfMeasurement().value());
      addField(recordList, entity.getCustomUnitOfMeasurement());
      addField(
          recordList, entity.getGranularity() == null ? null : entity.getGranularity().value());
      addField(
          recordList,
          expression == null || expression.getLanguage() == null
              ? null
              : expression.getLanguage().value());
      addField(recordList, expression == null ? null : expression.getCode());
      addEntityReferences(recordList, entity.getRelatedMetrics());
      addTagLabels(recordList, entity.getTags());
      addGlossaryTerms(recordList, entity.getTags());
      addTagTiers(recordList, entity.getTags());
      addOwners(recordList, entity.getOwners());
      addReviewers(recordList, entity.getReviewers());
      addEntityReferences(recordList, entity.getDomains());
      addEntityReferences(recordList, entity.getDataProducts());
      addField(
          recordList, entity.getEntityStatus() == null ? null : entity.getEntityStatus().value());
      addExtension(recordList, entity.getExtension());
      addRecord(csvFile, recordList);
    }

    private MetricExpression getMetricExpression(CSVPrinter printer, CSVRecord csvRecord)
        throws IOException {
      MetricExpressionLanguage language = getExpressionLanguage(printer, csvRecord, 7);
      String code = csvRecord.get(8);
      if (language == null && nullOrEmpty(code)) {
        return null;
      }
      return new MetricExpression().withLanguage(language).withCode(code);
    }

    private MetricType getMetricType(CSVPrinter printer, CSVRecord csvRecord, int fieldNumber)
        throws IOException {
      if (nullOrEmpty(csvRecord.get(fieldNumber))) {
        return null;
      }
      try {
        return MetricType.fromValue(csvRecord.get(fieldNumber));
      } catch (Exception ex) {
        importFailure(
            printer,
            invalidField(fieldNumber, "Metric type " + csvRecord.get(fieldNumber) + " is invalid"),
            csvRecord);
        processRecord = false;
        return null;
      }
    }

    private MetricUnitOfMeasurement getUnitOfMeasurement(
        CSVPrinter printer, CSVRecord csvRecord, int fieldNumber) throws IOException {
      if (nullOrEmpty(csvRecord.get(fieldNumber))) {
        return null;
      }
      try {
        return MetricUnitOfMeasurement.fromValue(csvRecord.get(fieldNumber));
      } catch (Exception ex) {
        importFailure(
            printer,
            invalidField(
                fieldNumber,
                "Metric unit of measurement " + csvRecord.get(fieldNumber) + " is invalid"),
            csvRecord);
        processRecord = false;
        return null;
      }
    }

    private MetricGranularity getGranularity(
        CSVPrinter printer, CSVRecord csvRecord, int fieldNumber) throws IOException {
      if (nullOrEmpty(csvRecord.get(fieldNumber))) {
        return null;
      }
      try {
        return MetricGranularity.fromValue(csvRecord.get(fieldNumber));
      } catch (Exception ex) {
        importFailure(
            printer,
            invalidField(
                fieldNumber, "Metric granularity " + csvRecord.get(fieldNumber) + " is invalid"),
            csvRecord);
        processRecord = false;
        return null;
      }
    }

    private MetricExpressionLanguage getExpressionLanguage(
        CSVPrinter printer, CSVRecord csvRecord, int fieldNumber) throws IOException {
      if (nullOrEmpty(csvRecord.get(fieldNumber))) {
        return null;
      }
      try {
        return MetricExpressionLanguage.fromValue(csvRecord.get(fieldNumber));
      } catch (Exception ex) {
        importFailure(
            printer,
            invalidField(
                fieldNumber,
                "Metric expression language " + csvRecord.get(fieldNumber) + " is invalid"),
            csvRecord);
        processRecord = false;
        return null;
      }
    }

    private EntityStatus getEntityStatus(CSVPrinter printer, CSVRecord csvRecord, int fieldNumber)
        throws IOException {
      if (nullOrEmpty(csvRecord.get(fieldNumber))) {
        return null;
      }
      try {
        return EntityFieldUtils.parseEntityStatus(csvRecord.get(fieldNumber));
      } catch (Exception ex) {
        importFailure(
            printer,
            invalidField(
                fieldNumber, "Entity status " + csvRecord.get(fieldNumber) + " is invalid"),
            csvRecord);
        processRecord = false;
        return null;
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
      MemoryOwnership.releaseIfHumanEdited(updated, operation.isPatch(), managedFieldChanged());
    }

    private boolean managedFieldChanged() {
      return !Objects.equals(original.getName(), updated.getName())
          || !Objects.equals(original.getDisplayName(), updated.getDisplayName())
          || !Objects.equals(original.getDescription(), updated.getDescription())
          || !Objects.equals(original.getMetricType(), updated.getMetricType())
          || !Objects.equals(original.getMetricExpression(), updated.getMetricExpression());
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
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    taskRepository.closeApprovalTaskForEntity(
        entity.getFullyQualifiedName(), entity.getUpdatedBy(), comment);
  }

  protected void updateTaskWithNewReviewers(Metric metric) {
    metric =
        Entity.getEntityByName(
            Entity.METRIC,
            metric.getFullyQualifiedName(),
            "id,fullyQualifiedName,reviewers",
            Include.ALL);
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    taskRepository.updateApprovalTaskAssignees(
        metric.getFullyQualifiedName(),
        new ArrayList<>(metric.getReviewers()),
        metric.getUpdatedBy());
  }
}
