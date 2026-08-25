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
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.data.MetricAssetDirection;
import org.openmetadata.schema.api.data.MetricDimension;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.api.data.MetricHierarchyContext;
import org.openmetadata.schema.api.data.MetricHierarchyItem;
import org.openmetadata.schema.api.data.MetricMeasure;
import org.openmetadata.schema.api.data.MetricObservability;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetricExpressionLanguage;
import org.openmetadata.schema.type.MetricGranularity;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.metrics.MetricResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityFieldUtils;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MetricRepository extends EntityRepository<Metric> {
  private static final String UPDATE_FIELDS =
      "relatedMetrics,dimensions,measures,filters,parent,metricGroup";
  private static final String PATCH_FIELDS =
      "relatedMetrics,dimensions,measures,filters,parent,metricGroup";
  static final String FIELD_ASSETS = "assets";
  static final String FIELD_PARENT = "parent";
  static final String FIELD_CHILDREN = "children";
  static final String FIELD_CHILDREN_COUNT = "childrenCount";
  static final String FIELD_METRIC_GROUP = "metricGroup";
  private static final int ASSET_SCAN_BATCH_SIZE = 200;
  private static final int HIERARCHY_SCAN_BATCH_SIZE = 200;
  static final int MAX_OBSERVABILITY_ASSET_DETAILS = 1_000;
  private static final String HIERARCHY_FIELDS =
      "owners,experts,reviewers,parent,childrenCount,metricGroup,domains,tags";

  private final MetricObservabilityBuilder observabilityBuilder =
      new MetricObservabilityBuilder(this);

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

    // Asset relationships are served and mutated only through the bounded /assets APIs. Keeping
    // this relationship-derived model property out of generic fields also prevents fields=assets
    // from rebuilding an unbounded list on Metric GET/list requests.
    allowedFields.remove(FIELD_ASSETS);

    fieldFetchers.put("relatedMetrics", this::fetchAndSetRelatedMetrics);
    fieldFetchers.put(FIELD_PARENT, this::fetchAndSetParents);
    fieldFetchers.put(FIELD_CHILDREN, this::fetchAndSetChildren);
    fieldFetchers.put(FIELD_CHILDREN_COUNT, this::fetchAndSetChildrenCount);
    fieldFetchers.put(FIELD_METRIC_GROUP, this::fetchAndSetMetricGroups);
  }

  @Override
  public void setFullyQualifiedName(Metric metric) {
    metric.setFullyQualifiedName(metric.getName());
    setDimensionFQNs(metric.getFullyQualifiedName(), metric.getDimensions());
    setMeasureFQNs(metric.getFullyQualifiedName(), metric.getMeasures());
  }

  private void setDimensionFQNs(String metricFqn, List<MetricDimension> dimensions) {
    if (nullOrEmpty(dimensions)) {
      return;
    }
    final String prefix = FullyQualifiedName.add(metricFqn, "dimension");
    for (final MetricDimension dimension : dimensions) {
      dimension.setFullyQualifiedName(FullyQualifiedName.add(prefix, dimension.getName()));
    }
  }

  private void setMeasureFQNs(String metricFqn, List<MetricMeasure> measures) {
    if (nullOrEmpty(measures)) {
      return;
    }
    final String prefix = FullyQualifiedName.add(metricFqn, "measure");
    for (final MetricMeasure measure : measures) {
      measure.setFullyQualifiedName(FullyQualifiedName.add(prefix, measure.getName()));
    }
  }

  @Override
  public void prepare(Metric metric, boolean update) {
    validateRelatedTerms(metric, metric.getRelatedMetrics());
    validateCustomUnitOfMeasurement(metric);
    metric.setAssets(EntityUtil.populateEntityReferences(metric.getAssets()));
    validateSelfParentReference(metric);
    if (metric.getParent() != null) {
      metric.setParent(Entity.getEntityReference(metric.getParent().withType(METRIC), NON_DELETED));
    }
    resolveHierarchyGroup(metric);
    validateHierarchy(metric);
  }

  private void resolveHierarchyGroup(Metric metric) {
    EntityReference requestedGroup = resolveGroup(metric.getMetricGroup());
    EntityReference inheritedGroup = groupForParent(metric.getParent());
    metric.setMetricGroup(
        effectiveHierarchyGroup(metric.getParent(), requestedGroup, inheritedGroup));
  }

  static EntityReference effectiveHierarchyGroup(
      EntityReference parent, EntityReference requestedGroup, EntityReference inheritedGroup) {
    return parent == null ? requestedGroup : inheritedGroup;
  }

  static void validateSelfParentReference(Metric metric) {
    EntityReference parent = metric.getParent();
    if (parent == null) {
      return;
    }
    String metricFqn =
        metric.getFullyQualifiedName() == null ? metric.getName() : metric.getFullyQualifiedName();
    String parentFqn =
        parent.getFullyQualifiedName() == null ? parent.getName() : parent.getFullyQualifiedName();
    if (metricFqn != null && metricFqn.equals(parentFqn)) {
      throw new IllegalArgumentException(
          String.format(
              "Invalid hierarchy: Metric '%s' cannot be its own parent", metric.getName()));
    }
  }

  private EntityReference resolveGroup(EntityReference group) {
    return group == null
        ? null
        : Entity.getEntityReference(group.withType(Entity.METRIC_GROUP), NON_DELETED);
  }

  private EntityReference groupForParent(EntityReference parent) {
    EntityReference result = null;
    if (parent != null) {
      List<EntityReference> groups =
          findFrom(parent.getId(), METRIC, Relationship.HAS, Entity.METRIC_GROUP);
      result = groups.isEmpty() ? null : groups.getFirst();
    }
    return result;
  }

  /**
   * Rejects a parent assignment that would make the metric its own ancestor. Metric fully qualified
   * names are flat, so unlike glossary terms there is no FQN prefix to compare — the ancestor chain
   * has to be walked one CONTAINS edge at a time. The visited set both terminates the walk and
   * catches pre-existing cycles in the stored data.
   */
  private void validateHierarchy(Metric metric) {
    EntityReference parent = metric.getParent();
    if (parent == null) {
      return;
    }
    if (metric.getId() != null && metric.getId().equals(parent.getId())) {
      throw new IllegalArgumentException(
          String.format(
              "Invalid hierarchy: Metric '%s' cannot be its own parent", metric.getName()));
    }
    if (metric.getName() != null && metric.getName().equals(parent.getName())) {
      throw new IllegalArgumentException(
          String.format(
              "Invalid hierarchy: Metric '%s' cannot be its own parent", metric.getName()));
    }
    if (metric.getId() == null || parent.getId() == null) {
      return;
    }
    Set<UUID> visited = new HashSet<>();
    visited.add(metric.getId());
    UUID ancestorId = parent.getId();
    while (ancestorId != null) {
      if (visited.contains(ancestorId)) {
        throw new IllegalArgumentException(
            String.format(
                "Circular reference detected: Cannot set parent relationship as it would create a cycle. "
                    + "Metric '%s' (or one of its descendants) already exists in the parent chain.",
                metric.getName()));
      }
      visited.add(ancestorId);
      List<CollectionDAO.EntityRelationshipRecord> ancestors =
          daoCollection
              .relationshipDAO()
              .findFrom(ancestorId, METRIC, Relationship.CONTAINS.ordinal(), METRIC);
      ancestorId = ancestors.isEmpty() ? null : ancestors.getFirst().getId();
    }
  }

  /**
   * A metric with no reviewers has nothing to approve, so it starts life Approved. With reviewers
   * it starts as Draft and MetricApprovalWorkflow drives it through review. Unlike glossary terms
   * there is no reviewer inheritance — a metric's parent does not lend it reviewers.
   */
  @Override
  protected void setDefaultStatus(Metric entity, boolean update) {
    if (!update
        || entity.getEntityStatus() == null
        || entity.getEntityStatus() == EntityStatus.UNPROCESSED) {
      entity.setEntityStatus(
          nullOrEmpty(entity.getReviewers()) ? EntityStatus.APPROVED : EntityStatus.DRAFT);
    }
  }

  private void validateCustomUnitOfMeasurement(Metric metric) {
    MetricUnitOfMeasurement unitOfMeasurement = metric.getUnitOfMeasurement();
    String customUnit = metric.getCustomUnitOfMeasurement();

    if (unitOfMeasurement == MetricUnitOfMeasurement.OTHER) {
      if (CommonUtil.nullOrEmpty(customUnit)) {
        throw new IllegalArgumentException(
            "customUnitOfMeasurement is required when unitOfMeasurement is OTHER");
      }
      metric.setCustomUnitOfMeasurement(customUnit.trim());
    } else {
      metric.setCustomUnitOfMeasurement(null);
    }
  }

  @Override
  public void setFields(
      Metric metric, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    metric.setRelatedMetrics(
        fields.contains("relatedMetrics") ? getRelatedMetrics(metric) : metric.getRelatedMetrics());
    metric.setAssets(fields.contains(FIELD_ASSETS) ? getAssets(metric) : metric.getAssets());
    metric.setParent(fields.contains(FIELD_PARENT) ? getParent(metric) : metric.getParent());
    metric.setChildren(
        fields.contains(FIELD_CHILDREN) ? getChildren(metric) : metric.getChildren());
    metric.setChildrenCount(
        fields.contains(FIELD_CHILDREN_COUNT)
            ? getChildrenCount(metric)
            : metric.getChildrenCount());
    metric.setMetricGroup(
        fields.contains(FIELD_METRIC_GROUP) ? getMetricGroup(metric) : metric.getMetricGroup());
  }

  /**
   * The group a metric belongs to, derived from the group's HAS edge. Groups own the membership
   * list, so this is read-only on the metric — adding a metric to a group is done through the
   * group's own endpoints.
   */
  private EntityReference getMetricGroup(Metric metric) {
    String groupId =
        daoCollection.metricDAO().findActiveGroupId(metric.getId(), Relationship.HAS.ordinal());
    return groupId == null
        ? null
        : Entity.getEntityReferenceById(Entity.METRIC_GROUP, UUID.fromString(groupId), NON_DELETED);
  }

  @Override
  protected void clearFields(Metric entity, EntityUtil.Fields fields) {
    entity.setRelatedMetrics(fields.contains("relatedMetrics") ? entity.getRelatedMetrics() : null);
    entity.setAssets(fields.contains(FIELD_ASSETS) ? entity.getAssets() : null);
    entity.setParent(fields.contains(FIELD_PARENT) ? entity.getParent() : null);
    entity.setChildren(fields.contains(FIELD_CHILDREN) ? entity.getChildren() : null);
    entity.setChildrenCount(
        fields.contains(FIELD_CHILDREN_COUNT) ? entity.getChildrenCount() : null);
    entity.setMetricGroup(fields.contains(FIELD_METRIC_GROUP) ? entity.getMetricGroup() : null);
  }

  private Integer getChildrenCount(Metric metric) {
    return daoCollection
        .relationshipDAO()
        .countNonDeletedChildMetrics(metric.getId(), Relationship.CONTAINS.ordinal());
  }

  @Override
  protected List<EntityReference> getChildren(Metric metric) {
    return findTo(metric.getId(), METRIC, Relationship.CONTAINS, METRIC);
  }

  /**
   * Data assets this metric applies to. Edge direction: from=metric to=asset via APPLIED_TO;
   * findTo resolves the to-side (the assets).
   */
  private List<EntityReference> getAssets(Metric metric) {
    return findTo(metric.getId(), METRIC, Relationship.APPLIED_TO, null);
  }

  private void fetchAndSetRelatedMetrics(List<Metric> metrics, EntityUtil.Fields fields) {
    if (!fields.contains("relatedMetrics") || metrics == null || metrics.isEmpty()) {
      return;
    }
    setFieldFromMap(true, metrics, batchFetchRelatedMetrics(metrics), Metric::setRelatedMetrics);
  }

  private void fetchAndSetParents(List<Metric> metrics, EntityUtil.Fields fields) {
    if (!fields.contains(FIELD_PARENT) || nullOrEmpty(metrics)) {
      return;
    }
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(metrics), Relationship.CONTAINS.ordinal(), METRIC, NON_DELETED);
    Map<UUID, EntityReference> parents = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : records) {
      parents.put(
          UUID.fromString(record.getToId()),
          Entity.getEntityReferenceById(METRIC, UUID.fromString(record.getFromId()), NON_DELETED));
    }
    for (Metric metric : metrics) {
      metric.setParent(parents.get(metric.getId()));
    }
  }

  @Override
  protected void fetchAndSetChildren(List<Metric> metrics, EntityUtil.Fields fields) {
    if (!fields.contains(FIELD_CHILDREN) || nullOrEmpty(metrics)) {
      return;
    }
    Map<UUID, List<EntityReference>> children = new HashMap<>();
    for (Metric metric : metrics) {
      children.put(metric.getId(), new ArrayList<>());
    }
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatch(
                entityListToStrings(metrics), Relationship.CONTAINS.ordinal(), METRIC, METRIC);
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID parentId = UUID.fromString(record.getFromId());
      EntityReference child =
          Entity.getEntityReferenceById(METRIC, UUID.fromString(record.getToId()), NON_DELETED);
      children.get(parentId).add(child);
    }
    for (Metric metric : metrics) {
      metric.setChildren(children.get(metric.getId()));
    }
  }

  private void fetchAndSetMetricGroups(List<Metric> metrics, EntityUtil.Fields fields) {
    if (!fields.contains(FIELD_METRIC_GROUP) || nullOrEmpty(metrics)) {
      return;
    }
    Map<UUID, EntityReference> groups = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record :
        daoCollection
            .metricDAO()
            .findActiveGroups(entityListToStrings(metrics), Relationship.HAS.ordinal())) {
      groups.put(
          UUID.fromString(record.getToId()),
          Entity.getEntityReferenceById(
              Entity.METRIC_GROUP, UUID.fromString(record.getFromId()), NON_DELETED));
    }
    for (Metric metric : metrics) {
      metric.setMetricGroup(groups.get(metric.getId()));
    }
  }

  private void fetchAndSetChildrenCount(List<Metric> metrics, EntityUtil.Fields fields) {
    if (!fields.contains(FIELD_CHILDREN_COUNT) || nullOrEmpty(metrics)) {
      return;
    }
    Map<UUID, Integer> counts = new HashMap<>();
    for (CollectionDAO.EntityRelationshipCount record :
        daoCollection
            .relationshipDAO()
            .countNonDeletedChildMetricsBatch(
                entityListToStrings(metrics), Relationship.CONTAINS.ordinal())) {
      counts.put(record.getId(), record.getCount());
    }
    for (Metric metric : metrics) {
      metric.setChildrenCount(counts.getOrDefault(metric.getId(), 0));
    }
  }

  @Override
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of(
        "relatedMetrics",
        "assets",
        FIELD_PARENT,
        "children",
        FIELD_CHILDREN_COUNT,
        FIELD_METRIC_GROUP);
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
  public List<Metric> createManyEntitiesForImport(List<Metric> entities, String impersonatedBy) {
    List<Metric> created = super.createManyEntitiesForImport(entities, impersonatedBy);
    reconcileImportedHierarchyGroups(created);
    return created;
  }

  @Override
  public List<Metric> updateManyEntitiesForImport(
      List<Metric> originals, List<Metric> updates, String updatedBy, String impersonatedBy) {
    List<Metric> updated =
        super.updateManyEntitiesForImport(originals, updates, updatedBy, impersonatedBy);
    reconcileImportedHierarchyGroups(updated);
    return updated;
  }

  private void reconcileImportedHierarchyGroups(List<Metric> metrics) {
    if (nullOrEmpty(metrics)) {
      return;
    }
    MetricGroupRepository groupRepository =
        (MetricGroupRepository) Entity.getEntityRepository(Entity.METRIC_GROUP);
    for (Metric metric : metrics) {
      if (metric.getParent() == null) {
        MetricGroupRepository.MembershipChange change =
            groupRepository.assignHierarchyGroup(metric.getId(), metric.getMetricGroup());
        groupRepository.publishMembershipChange(change);
      }
    }
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<Metric> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Metric::getId).toList();
    deleteFromMany(ids, METRIC, Relationship.EXPERT, USER);
    deleteFromMany(ids, Entity.METRIC, Relationship.RELATED_TO, Entity.METRIC);
    deleteToMany(ids, Entity.METRIC, Relationship.RELATED_TO, Entity.METRIC);
    // Mirror storeRelationships' re-add of the APPLIED_TO edges so the batch import/update path
    // replaces the asset list instead of unioning with stale edges (which AIContextBuilder would
    // keep routing). Assets are heterogeneous, so pass a null toEntity to clear every type from the
    // metric (the FROM side). Only clear for metrics that actually carry an asset list: assets is
    // not a CSV column, so a CSV import leaves it null to mean "unchanged" — clearing those would
    // wipe the existing edges. A null list preserves; an empty list explicitly clears.
    List<UUID> assetCarryingIds =
        entities.stream().filter(metric -> metric.getAssets() != null).map(Metric::getId).toList();
    deleteFromMany(assetCarryingIds, Entity.METRIC, Relationship.APPLIED_TO, null);
    // Only the to-side (metric-as-child) CONTAINS edge is cleared, so storeRelationships can
    // re-add the parent link. Clearing the from-side would orphan the metric's own children and
    // also drop the metric -> dataContract CONTAINS edges, which are not re-added here.
    deleteToMany(ids, Entity.METRIC, Relationship.CONTAINS, Entity.METRIC);
    deleteToMany(ids, Entity.METRIC, Relationship.HAS, Entity.METRIC_GROUP);
  }

  @Override
  public void storeRelationships(Metric metric) {
    for (EntityReference expert : listOrEmpty(metric.getExperts())) {
      addRelationship(metric.getId(), expert.getId(), METRIC, USER, Relationship.EXPERT);
    }
    for (EntityReference relatedMetric : listOrEmpty(metric.getRelatedMetrics())) {
      addRelationship(
          metric.getId(), relatedMetric.getId(), METRIC, METRIC, Relationship.RELATED_TO, true);
    }
    for (EntityReference asset : listOrEmpty(metric.getAssets())) {
      addRelationship(
          metric.getId(), asset.getId(), METRIC, asset.getType(), Relationship.APPLIED_TO);
    }
    if (metric.getParent() != null) {
      addRelationship(
          metric.getParent().getId(), metric.getId(), METRIC, METRIC, Relationship.CONTAINS);
    }
    replaceGroupMembership(metric);
  }

  private void replaceGroupMembership(Metric metric) {
    for (EntityReference group :
        findFrom(metric.getId(), METRIC, Relationship.HAS, Entity.METRIC_GROUP)) {
      if (!sameReferenceById(group, metric.getMetricGroup())) {
        deleteRelationship(
            group.getId(), Entity.METRIC_GROUP, metric.getId(), METRIC, Relationship.HAS);
      }
    }
    if (metric.getMetricGroup() != null) {
      addRelationship(
          metric.getMetricGroup().getId(),
          metric.getId(),
          Entity.METRIC_GROUP,
          METRIC,
          Relationship.HAS);
    }
  }

  @Override
  public void restorePatchAttributes(Metric original, Metric updated) {
    super.restorePatchAttributes(original, updated);
    // children/childrenCount are derived from CONTAINS edges and cannot be patched directly
    updated.withChildren(original.getChildren()).withChildrenCount(original.getChildrenCount());
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
              .withExtension(getExtension(printer, csvRecord, 18))
              .withParent(getEntityReference(printer, csvRecord, 19, METRIC))
              .withExperts(getEntityReferences(printer, csvRecord, 20, USER))
              .withMetricGroup(getEntityReference(printer, csvRecord, 21, Entity.METRIC_GROUP));

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
      addField(
          recordList,
          entity.getParent() == null ? null : entity.getParent().getFullyQualifiedName());
      addEntityReferences(recordList, entity.getExperts());
      addField(
          recordList,
          entity.getMetricGroup() == null ? null : entity.getMetricGroup().getFullyQualifiedName());
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
      compareAndUpdate(
          "dimensions",
          () -> recordChange("dimensions", original.getDimensions(), updated.getDimensions()));
      compareAndUpdate(
          "measures",
          () -> recordChange("measures", original.getMeasures(), updated.getMeasures()));
      compareAndUpdate(
          "filters", () -> recordChange("filters", original.getFilters(), updated.getFilters()));
      compareAndUpdate("relatedMetrics", () -> updateRelatedMetrics(original, updated));
      compareAndUpdate(FIELD_PARENT, () -> updateParent(original, updated));
      compareAndUpdateAny(
          () -> updateMetricGroup(original, updated), FIELD_PARENT, FIELD_METRIC_GROUP);
    }

    private void updateMetricGroup(Metric original, Metric updated) {
      if (!sameReferenceById(original.getMetricGroup(), updated.getMetricGroup())) {
        MetricGroupRepository groupRepository =
            (MetricGroupRepository) Entity.getEntityRepository(Entity.METRIC_GROUP);
        MetricGroupRepository.MembershipChange change =
            groupRepository.assignHierarchyGroup(updated.getId(), updated.getMetricGroup());
        deferReactOperation(() -> groupRepository.publishMembershipChange(change));
        recordChange(
            FIELD_METRIC_GROUP,
            original.getMetricGroup(),
            updated.getMetricGroup(),
            true,
            MetricRepository::sameReferenceById);
      }
    }

    /**
     * Swaps the CONTAINS edge to the new parent. Metric fully qualified names are flat, so — unlike
     * glossary terms — reparenting rewrites no FQNs and cascades to no descendants.
     */
    private void updateParent(Metric original, Metric updated) {
      EntityReference originalParent = original.getParent();
      EntityReference updatedParent = updated.getParent();
      if (sameReferenceById(originalParent, updatedParent)) {
        return;
      }
      validateHierarchy(updated);
      if (originalParent != null) {
        deleteRelationship(
            originalParent.getId(), METRIC, original.getId(), METRIC, Relationship.CONTAINS);
      }
      if (updatedParent != null) {
        addRelationship(
            updatedParent.getId(), updated.getId(), METRIC, METRIC, Relationship.CONTAINS);
      }
      recordChange(
          FIELD_PARENT, originalParent, updatedParent, true, MetricRepository::sameReferenceById);
      // Both parents' search documents carry children/childrenCount, so refresh them or the counts
      // drift until the next full reindex.
      refreshParentDocument(originalParent);
      refreshParentDocument(updatedParent);
    }

    private void refreshParentDocument(EntityReference parent) {
      if (parent != null) {
        EntityLifecycleEventDispatcher.getInstance().onEntityUpdated(parent, null);
      }
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

  public MetricObservability getObservability(UUID metricId) {
    return observabilityBuilder.build(metricId);
  }

  public MetricObservability getObservability(UUID metricId, Set<UUID> visibleAssetIds) {
    return observabilityBuilder.build(metricId, visibleAssetIds);
  }

  public MetricObservability getObservability(
      UUID metricId, List<MetricAssetDirection> linkedAssets, Set<UUID> visibleAssetIds) {
    return observabilityBuilder.build(metricId, linkedAssets, visibleAssetIds);
  }

  public ResultList<MetricHierarchyItem> listHierarchy(int limit, int offset, String query) {
    String nameLike = MetricGroupRepository.buildNameLike(query);
    HierarchyScan scan = scanUnrestrictedHierarchyRows(limit, offset, nameLike);
    List<CollectionDAO.MetricDAO.HierarchyRow> rows = scan.rows();
    Map<UUID, Metric> metrics = loadMetricsById(hierarchyIds(rows, METRIC));
    metrics.replaceAll(
        (id, metric) -> sanitizeHierarchyMetric(metric, ignored -> true, ignored -> true));
    Map<UUID, MetricGroup> groups = loadGroupsById(hierarchyIds(rows, Entity.METRIC_GROUP));
    return buildHierarchyResult(scan, limit, offset, metrics, groups);
  }

  public ResultList<MetricHierarchyItem> listHierarchy(
      int limit,
      int offset,
      String query,
      Predicate<EntityReference> canViewMetric,
      Predicate<EntityReference> canViewGroup) {
    CollectionDAO.MetricDAO metricDAO = daoCollection.metricDAO();
    String nameLike = MetricGroupRepository.buildNameLike(query);
    HierarchyScan scan =
        scanHierarchyRows(metricDAO, limit, offset, query, nameLike, canViewMetric, canViewGroup);
    List<CollectionDAO.MetricDAO.HierarchyRow> rows = scan.rows();
    Map<UUID, Metric> metrics = loadMetricsById(hierarchyIds(rows, METRIC));
    metrics.replaceAll(
        (id, metric) ->
            sanitizeHierarchyMetricWithVisibleCount(metric, canViewMetric, canViewGroup));
    Map<UUID, MetricGroup> groups =
        loadGroupsById(hierarchyIds(rows, Entity.METRIC_GROUP), canViewMetric);
    return buildHierarchyResult(scan, limit, offset, metrics, groups);
  }

  HierarchyScan scanUnrestrictedHierarchyRows(int limit, int offset, String nameLike) {
    CollectionDAO.MetricDAO metricDAO = daoCollection.metricDAO();
    List<CollectionDAO.MetricDAO.HierarchyRow> rows =
        metricDAO.listHierarchy(
            Relationship.CONTAINS.ordinal(), Relationship.HAS.ordinal(), nameLike, limit, offset);
    int total =
        metricDAO.countHierarchy(
            Relationship.CONTAINS.ordinal(), Relationship.HAS.ordinal(), nameLike);
    return new HierarchyScan(rows, total);
  }

  private ResultList<MetricHierarchyItem> buildHierarchyResult(
      HierarchyScan scan,
      int limit,
      int offset,
      Map<UUID, Metric> metrics,
      Map<UUID, MetricGroup> groups) {
    List<MetricHierarchyItem> data = new ArrayList<>();
    for (CollectionDAO.MetricDAO.HierarchyRow row : scan.rows()) {
      data.add(toHierarchyItem(row, metrics, groups));
    }
    Paging paging = new Paging().withOffset(offset).withLimit(limit).withTotal(scan.total());
    return new ResultList<>(data, paging);
  }

  private HierarchyScan scanHierarchyRows(
      CollectionDAO.MetricDAO metricDAO,
      int limit,
      int offset,
      String query,
      String nameLike,
      Predicate<EntityReference> canViewMetric,
      Predicate<EntityReference> canViewGroup) {
    List<CollectionDAO.MetricDAO.HierarchyRow> page = new ArrayList<>();
    int databaseOffset = 0;
    int visible = 0;
    List<CollectionDAO.MetricDAO.HierarchyRow> batch;
    do {
      batch =
          metricDAO.listHierarchy(
              Relationship.CONTAINS.ordinal(),
              Relationship.HAS.ordinal(),
              nameLike,
              HIERARCHY_SCAN_BATCH_SIZE,
              databaseOffset);
      Map<UUID, EntityReference> metricReferences =
          loadReferences(hierarchyIds(batch, METRIC), METRIC);
      Map<UUID, EntityReference> groupReferences =
          loadReferences(hierarchyIds(batch, Entity.METRIC_GROUP), Entity.METRIC_GROUP);
      for (CollectionDAO.MetricDAO.HierarchyRow row : batch) {
        EntityReference reference =
            METRIC.equals(row.entityType())
                ? metricReferences.get(row.id())
                : groupReferences.get(row.id());
        if (reference != null
            && hierarchyRowVisible(row, reference, query, canViewMetric, canViewGroup)) {
          if (visible >= offset && page.size() < limit) {
            page.add(row);
          }
          visible++;
        }
      }
      databaseOffset += batch.size();
    } while (batch.size() == HIERARCHY_SCAN_BATCH_SIZE);
    return new HierarchyScan(page, visible);
  }

  private boolean hierarchyRowVisible(
      CollectionDAO.MetricDAO.HierarchyRow row,
      EntityReference reference,
      String query,
      Predicate<EntityReference> canViewMetric,
      Predicate<EntityReference> canViewGroup) {
    if (METRIC.equals(row.entityType())) {
      return canViewMetric.test(reference)
          && subtreeMatchesQuery(reference.getId(), query, canViewMetric);
    }
    if (!canViewGroup.test(reference)) {
      return false;
    }
    if (MetricGroupRepository.referenceMatchesQuery(reference, query)) {
      return true;
    }
    MetricGroupRepository groupRepository =
        (MetricGroupRepository) Entity.getEntityRepository(Entity.METRIC_GROUP);
    return groupRepository.hasVisibleMemberMatching(reference.getId(), query, canViewMetric);
  }

  private boolean subtreeMatchesQuery(
      UUID rootId, String query, Predicate<EntityReference> canViewMetric) {
    if (nullOrEmpty(query) || query.trim().isEmpty()) {
      return true;
    }
    Set<UUID> ids = new LinkedHashSet<>();
    ArrayDeque<UUID> pending = new ArrayDeque<>(List.of(rootId));
    while (!pending.isEmpty()) {
      UUID current = pending.removeFirst();
      if (ids.add(current)) {
        daoCollection
            .metricDAO()
            .listDescendantSeedIds(current, Relationship.CONTAINS.ordinal())
            .stream()
            .map(UUID::fromString)
            .forEach(pending::addLast);
      }
    }
    return loadReferences(new ArrayList<>(ids), METRIC).values().stream()
        .anyMatch(
            metric ->
                canViewMetric.test(metric)
                    && MetricGroupRepository.referenceMatchesQuery(metric, query));
  }

  private List<UUID> hierarchyIds(
      List<CollectionDAO.MetricDAO.HierarchyRow> rows, String entityType) {
    return rows.stream()
        .filter(row -> entityType.equals(row.entityType()))
        .map(CollectionDAO.MetricDAO.HierarchyRow::id)
        .toList();
  }

  static MetricHierarchyItem toHierarchyItem(
      CollectionDAO.MetricDAO.HierarchyRow row,
      Map<UUID, Metric> metrics,
      Map<UUID, MetricGroup> groups) {
    MetricHierarchyItem item =
        new MetricHierarchyItem().withKind(MetricHierarchyItem.Kind.fromValue(row.entityType()));
    if (METRIC.equals(row.entityType())) {
      item.setMetric(metrics.get(row.id()));
    } else {
      item.setGroup(groups.get(row.id()));
    }
    return item;
  }

  private Map<UUID, Metric> loadMetricsById(List<UUID> ids) {
    List<Metric> metrics = daoCollection.metricDAO().findEntitiesByIds(ids, NON_DELETED);
    setFieldsInBulk(getFields(HIERARCHY_FIELDS), metrics);
    return metrics.stream().collect(Collectors.toMap(Metric::getId, metric -> metric));
  }

  private Map<UUID, MetricGroup> loadGroupsById(
      List<UUID> ids, Predicate<EntityReference> canViewMetric) {
    Map<UUID, MetricGroup> groups = loadGroupsById(ids);
    MetricGroupRepository repository = metricGroupRepository();
    groups
        .values()
        .forEach(
            group ->
                group.setMetricCount(repository.visibleMetricCount(group.getId(), canViewMetric)));
    return groups;
  }

  private Map<UUID, MetricGroup> loadGroupsById(List<UUID> ids) {
    List<MetricGroup> groups = daoCollection.metricGroupDAO().findEntitiesByIds(ids, NON_DELETED);
    MetricGroupRepository repository = metricGroupRepository();
    repository.setFieldsInBulk(repository.getFields("owners,domains,tags,metricCount"), groups);
    return groups.stream()
        .map(
            group -> {
              MetricGroup sanitized = JsonUtils.deepCopy(group, MetricGroup.class);
              sanitized.setMetrics(null);
              return sanitized;
            })
        .collect(Collectors.toMap(MetricGroup::getId, group -> group));
  }

  private MetricGroupRepository metricGroupRepository() {
    return (MetricGroupRepository) Entity.getEntityRepository(Entity.METRIC_GROUP);
  }

  public MetricHierarchyContext getHierarchyContext(
      UUID metricId, int childLimit, int childOffset, int siblingLimit, int siblingOffset) {
    return getHierarchyContext(
        metricId,
        childLimit,
        childOffset,
        siblingLimit,
        siblingOffset,
        ignored -> true,
        ignored -> true);
  }

  public MetricHierarchyContext getHierarchyContext(
      UUID metricId,
      int childLimit,
      int childOffset,
      int siblingLimit,
      int siblingOffset,
      Predicate<EntityReference> canViewMetric,
      Predicate<EntityReference> canViewGroup) {
    Metric current = get(null, metricId, getFields(HIERARCHY_FIELDS));
    List<Metric> ancestors = getAncestors(current, canViewMetric, canViewGroup);
    MetricPage children = childPage(current, childLimit, childOffset, canViewMetric, canViewGroup);
    MetricPage siblings =
        siblingPage(current, siblingLimit, siblingOffset, canViewMetric, canViewGroup);
    Metric sanitizedCurrent = sanitizeHierarchyMetric(current, canViewMetric, canViewGroup);
    sanitizedCurrent.setChildrenCount(children.paging().getTotal());
    return new MetricHierarchyContext()
        .withGroup(loadGroup(current.getMetricGroup(), canViewGroup, canViewMetric))
        .withCurrent(sanitizedCurrent)
        .withAncestors(ancestors)
        .withChildren(children.data())
        .withChildrenPaging(children.paging())
        .withSiblings(siblings.data())
        .withSiblingPaging(siblings.paging());
  }

  private List<Metric> getAncestors(
      Metric metric,
      Predicate<EntityReference> canViewMetric,
      Predicate<EntityReference> canViewGroup) {
    List<Metric> ancestors = new ArrayList<>();
    EntityReference parent = metric.getParent();
    Set<UUID> visited = new HashSet<>();
    while (parent != null && visited.add(parent.getId())) {
      Metric ancestor = get(null, parent.getId(), getFields(HIERARCHY_FIELDS));
      if (canViewMetric.test(ancestor.getEntityReference())) {
        ancestors.add(
            sanitizeHierarchyMetricWithVisibleCount(ancestor, canViewMetric, canViewGroup));
      }
      parent = ancestor.getParent();
    }
    Collections.reverse(ancestors);
    return ancestors;
  }

  private MetricGroup loadGroup(
      EntityReference reference,
      Predicate<EntityReference> canViewGroup,
      Predicate<EntityReference> canViewMetric) {
    MetricGroup result = null;
    if (reference != null && canViewGroup.test(reference)) {
      MetricGroupRepository repository =
          (MetricGroupRepository) Entity.getEntityRepository(Entity.METRIC_GROUP);
      result =
          repository.get(
              null, reference.getId(), repository.getFields("owners,domains,tags,metricCount"));
      result = JsonUtils.deepCopy(result, MetricGroup.class);
      result.setMetrics(null);
      result.setMetricCount(repository.visibleMetricCount(result.getId(), canViewMetric));
    }
    return result;
  }

  private MetricPage childPage(
      Metric current,
      int limit,
      int offset,
      Predicate<EntityReference> canViewMetric,
      Predicate<EntityReference> canViewGroup) {
    return scanMetricPage(
        (batchLimit, batchOffset) ->
            daoCollection
                .metricDAO()
                .listChildIds(
                    current.getId(), Relationship.CONTAINS.ordinal(), batchLimit, batchOffset),
        limit,
        offset,
        canViewMetric,
        canViewGroup);
  }

  private MetricPage siblingPage(
      Metric current,
      int limit,
      int offset,
      Predicate<EntityReference> canViewMetric,
      Predicate<EntityReference> canViewGroup) {
    MetricIdPageLoader loader = (batchLimit, batchOffset) -> List.of();
    if (current.getParent() != null) {
      loader =
          (batchLimit, batchOffset) ->
              daoCollection
                  .metricDAO()
                  .listSiblingIds(
                      current.getParent().getId(),
                      current.getId(),
                      Relationship.CONTAINS.ordinal(),
                      batchLimit,
                      batchOffset);
    } else if (current.getMetricGroup() != null) {
      loader = (batchLimit, batchOffset) -> groupRootSiblingIds(current, batchLimit, batchOffset);
    }
    return scanMetricPage(loader, limit, offset, canViewMetric, canViewGroup);
  }

  private List<String> groupRootSiblingIds(Metric current, int limit, int offset) {
    return daoCollection
        .metricGroupDAO()
        .listRootMemberIds(
            current.getMetricGroup().getId(),
            current.getId(),
            Relationship.HAS.ordinal(),
            Relationship.CONTAINS.ordinal(),
            limit,
            offset);
  }

  private MetricPage scanMetricPage(
      MetricIdPageLoader loader,
      int limit,
      int offset,
      Predicate<EntityReference> canViewMetric,
      Predicate<EntityReference> canViewGroup) {
    List<UUID> page = new ArrayList<>();
    int databaseOffset = 0;
    int visible = 0;
    List<String> batch;
    do {
      batch = loader.load(HIERARCHY_SCAN_BATCH_SIZE, databaseOffset);
      List<UUID> ids = batch.stream().map(UUID::fromString).toList();
      Map<UUID, EntityReference> references = loadReferences(ids, METRIC);
      for (UUID id : ids) {
        EntityReference reference = references.get(id);
        if (reference != null && canViewMetric.test(reference)) {
          if (visible >= offset && page.size() < limit) {
            page.add(id);
          }
          visible++;
        }
      }
      databaseOffset += batch.size();
    } while (batch.size() == HIERARCHY_SCAN_BATCH_SIZE);
    return metricPage(page, limit, offset, visible, canViewMetric, canViewGroup);
  }

  private Map<UUID, EntityReference> loadReferences(List<UUID> ids, String entityType) {
    if (ids.isEmpty()) {
      return Map.of();
    }
    return Entity.getEntityReferencesByIds(entityType, ids, NON_DELETED).stream()
        .collect(Collectors.toMap(EntityReference::getId, reference -> reference));
  }

  private MetricPage metricPage(
      List<UUID> ids,
      int limit,
      int offset,
      int total,
      Predicate<EntityReference> canViewMetric,
      Predicate<EntityReference> canViewGroup) {
    Map<UUID, Metric> metrics = loadMetricsById(ids);
    List<Metric> ordered =
        ids.stream()
            .map(metrics::get)
            .filter(Objects::nonNull)
            .map(
                metric ->
                    sanitizeHierarchyMetricWithVisibleCount(metric, canViewMetric, canViewGroup))
            .toList();
    Paging paging = new Paging().withOffset(offset).withLimit(limit).withTotal(total);
    return new MetricPage(ordered, paging);
  }

  private record MetricPage(List<Metric> data, Paging paging) {}

  record HierarchyScan(List<CollectionDAO.MetricDAO.HierarchyRow> rows, int total) {}

  @FunctionalInterface
  private interface MetricIdPageLoader {
    List<String> load(int limit, int offset);
  }

  static Metric sanitizeHierarchyMetric(
      Metric metric,
      Predicate<EntityReference> canViewMetric,
      Predicate<EntityReference> canViewGroup) {
    Metric sanitized = JsonUtils.deepCopy(metric, Metric.class);
    if (sanitized.getParent() != null && !canViewMetric.test(sanitized.getParent())) {
      sanitized.setParent(null);
    }
    if (sanitized.getMetricGroup() != null && !canViewGroup.test(sanitized.getMetricGroup())) {
      sanitized.setMetricGroup(null);
    }
    return sanitized;
  }

  private Metric sanitizeHierarchyMetricWithVisibleCount(
      Metric metric,
      Predicate<EntityReference> canViewMetric,
      Predicate<EntityReference> canViewGroup) {
    Metric sanitized = sanitizeHierarchyMetric(metric, canViewMetric, canViewGroup);
    sanitized.setChildrenCount(visibleChildCount(metric.getId(), canViewMetric));
    return sanitized;
  }

  int visibleChildCount(UUID metricId, Predicate<EntityReference> canViewMetric) {
    int databaseOffset = 0;
    int visible = 0;
    List<String> batch;
    do {
      batch =
          daoCollection
              .metricDAO()
              .listChildIds(
                  metricId,
                  Relationship.CONTAINS.ordinal(),
                  HIERARCHY_SCAN_BATCH_SIZE,
                  databaseOffset);
      List<UUID> ids = batch.stream().map(UUID::fromString).toList();
      visible += countVisibleReferences(loadReferences(ids, METRIC).values(), canViewMetric);
      databaseOffset += batch.size();
    } while (batch.size() == HIERARCHY_SCAN_BATCH_SIZE);
    return visible;
  }

  public List<EntityReference> hierarchySubtree(UUID rootMetricId) {
    Set<UUID> metricIds = new LinkedHashSet<>();
    ArrayDeque<UUID> pending = new ArrayDeque<>(List.of(rootMetricId));
    while (!pending.isEmpty()) {
      UUID current = pending.removeFirst();
      if (metricIds.add(current)) {
        daoCollection
            .metricDAO()
            .listDescendantSeedIds(current, Relationship.CONTAINS.ordinal())
            .stream()
            .map(UUID::fromString)
            .forEach(pending::addLast);
      }
    }
    return Entity.getEntityReferencesByIds(METRIC, new ArrayList<>(metricIds), NON_DELETED);
  }

  static int countVisibleReferences(
      Collection<EntityReference> references, Predicate<EntityReference> canViewEntity) {
    return (int) references.stream().filter(canViewEntity).count();
  }

  public BulkOperationResult bulkAddAssets(String metricName, BulkAssets request, String userName) {
    Metric metric = getByName(null, metricName, getFields("id"));
    return bulkAssetsOperation(
        metric.getId(), METRIC, Relationship.APPLIED_TO, request, true, userName);
  }

  public BulkOperationResult bulkRemoveAssets(
      String metricName, BulkAssets request, String userName) {
    Metric metric = getByName(null, metricName, getFields("id"));
    return bulkAssetsOperation(
        metric.getId(), METRIC, Relationship.APPLIED_TO, request, false, userName);
  }

  /**
   * Classifies each linked asset by where it sits relative to the metric in the lineage graph.
   * Direction is derived from lineage rather than stored, so linking an asset never has to say
   * which way the data flows — an asset the metric reads from is upstream, one that reads the
   * metric is downstream, and one with no lineage edge either way is unrelated.
   *
   * <p>Observability is deliberately capped before relationship hydration. Callers must use the
   * paginated assets endpoint when a metric exceeds this detail limit instead of creating an
   * unbounded request and response.
   */
  public List<MetricAssetDirection> getAssetsWithDirection(UUID metricId) {
    int linkedAssetCount =
        daoCollection
            .relationshipDAO()
            .countFindTo(metricId, METRIC, List.of(Relationship.APPLIED_TO.ordinal()));
    if (linkedAssetCount > MAX_OBSERVABILITY_ASSET_DETAILS) {
      throw new IllegalArgumentException(
          String.format(
              "Metric observability supports at most %,d linked assets. Use the paginated "
                  + "/assets endpoint to inspect larger asset sets.",
              MAX_OBSERVABILITY_ASSET_DETAILS));
    }
    return scanAssets(
            metricId, null, null, null, ignored -> true, 0, MAX_OBSERVABILITY_ASSET_DETAILS)
        .data();
  }

  public ResultList<MetricAssetDirection> listAssets(
      UUID metricId,
      int limit,
      int offset,
      String query,
      String entityType,
      MetricAssetDirection.Direction direction) {
    return listAssets(metricId, limit, offset, query, entityType, direction, ignored -> true);
  }

  public ResultList<MetricAssetDirection> listAssets(
      UUID metricId,
      int limit,
      int offset,
      String query,
      String entityType,
      MetricAssetDirection.Direction direction,
      Predicate<EntityReference> isVisible) {
    AssetScan scan = scanAssets(metricId, query, entityType, direction, isVisible, offset, limit);
    Paging paging = new Paging().withOffset(offset).withLimit(limit).withTotal(scan.total());
    return new ResultList<>(scan.data(), paging);
  }

  private AssetScan scanAssets(
      UUID metricId,
      String query,
      String entityType,
      MetricAssetDirection.Direction direction,
      Predicate<EntityReference> isVisible,
      int requestedOffset,
      int requestedLimit) {
    List<MetricAssetDirection> page = new ArrayList<>();
    int relationshipOffset = 0;
    int matched = 0;
    List<CollectionDAO.EntityRelationshipRecord> records;
    do {
      records = linkedAssetRecords(metricId, relationshipOffset);
      for (MetricAssetDirection asset : directionsFor(metricId, records)) {
        if (isVisible.test(asset.getAsset()) && matchesAsset(asset, query, entityType, direction)) {
          if (matched >= requestedOffset && page.size() < requestedLimit) {
            page.add(asset);
          }
          matched++;
        }
      }
      relationshipOffset += records.size();
    } while (records.size() == ASSET_SCAN_BATCH_SIZE);
    return new AssetScan(page, matched);
  }

  private List<CollectionDAO.EntityRelationshipRecord> linkedAssetRecords(
      UUID metricId, int offset) {
    return daoCollection
        .relationshipDAO()
        .findToWithOffset(
            metricId,
            METRIC,
            List.of(Relationship.APPLIED_TO.ordinal()),
            offset,
            ASSET_SCAN_BATCH_SIZE);
  }

  private List<MetricAssetDirection> directionsFor(
      UUID metricId, List<CollectionDAO.EntityRelationshipRecord> records) {
    List<EntityReference> assets =
        Entity.getEntityRelationshipRepository().getEntityReferences(records, NON_DELETED);
    if (assets.isEmpty()) {
      return List.of();
    }
    List<String> ids = assets.stream().map(asset -> asset.getId().toString()).toList();
    Set<UUID> upstreamIds =
        toIds(
            daoCollection
                .metricDAO()
                .findUpstreamAssetIds(metricId, ids, Relationship.UPSTREAM.ordinal()));
    Set<UUID> downstreamIds =
        toIds(
            daoCollection
                .metricDAO()
                .findDownstreamAssetIds(metricId, ids, Relationship.UPSTREAM.ordinal()));
    return assets.stream().map(asset -> withDirection(asset, upstreamIds, downstreamIds)).toList();
  }

  private MetricAssetDirection withDirection(
      EntityReference asset, Set<UUID> upstreamIds, Set<UUID> downstreamIds) {
    MetricAssetDirection.Direction direction =
        assetDirection(asset.getId(), upstreamIds, downstreamIds);
    return new MetricAssetDirection()
        .withAsset(asset)
        .withDirection(direction)
        .withAffectsHealth(
            Entity.TABLE.equals(asset.getType())
                && MetricAssetDirection.Direction.UPSTREAM.equals(direction));
  }

  private boolean matchesAsset(
      MetricAssetDirection asset,
      String query,
      String entityType,
      MetricAssetDirection.Direction direction) {
    boolean matchesType = nullOrEmpty(entityType) || entityType.equals(asset.getAsset().getType());
    boolean matchesDirection = direction == null || direction.equals(asset.getDirection());
    return matchesType && matchesDirection && matchesQuery(asset.getAsset(), query);
  }

  private boolean matchesQuery(EntityReference asset, String query) {
    boolean matches = true;
    if (!nullOrEmpty(query)) {
      String needle = query.trim().toLowerCase(Locale.ROOT);
      matches =
          containsIgnoreCase(asset.getName(), needle)
              || containsIgnoreCase(asset.getDisplayName(), needle)
              || containsIgnoreCase(asset.getFullyQualifiedName(), needle);
    }
    return matches;
  }

  private boolean containsIgnoreCase(String value, String lowerCaseNeedle) {
    return value != null && value.toLowerCase(Locale.ROOT).contains(lowerCaseNeedle);
  }

  static MetricAssetDirection.Direction assetDirection(
      UUID assetId, Set<UUID> upstreamIds, Set<UUID> downstreamIds) {
    MetricAssetDirection.Direction direction = MetricAssetDirection.Direction.UNRELATED;
    if (upstreamIds.contains(assetId)) {
      direction = MetricAssetDirection.Direction.UPSTREAM;
    } else if (downstreamIds.contains(assetId)) {
      direction = MetricAssetDirection.Direction.DOWNSTREAM;
    }
    return direction;
  }

  private Set<UUID> toIds(List<String> ids) {
    Set<UUID> result = new HashSet<>();
    ids.stream().map(UUID::fromString).forEach(result::add);
    return result;
  }

  private record AssetScan(List<MetricAssetDirection> data, int total) {}

  public List<String> getDistinctCustomUnitsOfMeasurement() {
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
  protected void postCreate(Metric metric) {
    super.postCreate(metric);
    refreshMetricGroup(metric.getMetricGroup());
  }

  @Override
  protected void postDelete(Metric metric, boolean hardDelete) {
    super.postDelete(metric, hardDelete);
    refreshMetricGroup(metric.getMetricGroup());
  }

  private void refreshMetricGroup(EntityReference group) {
    if (group != null) {
      EntityLifecycleEventDispatcher.getInstance().onEntityUpdated(group, null);
    }
  }

  static boolean sameReferenceById(EntityReference left, EntityReference right) {
    return left == right
        || (left != null && right != null && Objects.equals(left.getId(), right.getId()));
  }

  @Override
  public void postUpdate(Metric original, Metric updated) {
    super.postUpdate(original, updated);
    refreshMetricGroup(original.getMetricGroup());
    if (!sameReferenceById(original.getMetricGroup(), updated.getMetricGroup())) {
      refreshMetricGroup(updated.getMetricGroup());
    }
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
