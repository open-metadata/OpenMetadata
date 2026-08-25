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
import static org.openmetadata.service.Entity.METRIC_GROUP;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.resources.metrics.MetricGroupResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RequestEntityCache;

/**
 * A Metric Group is a named collection of metrics used to organize them for browsing.
 *
 * <p>Membership is modelled as {@link Relationship#HAS} rather than {@code CONTAINS} on purpose:
 * the base {@code deleteChildren} cascade only walks {@code CONTAINS}/{@code PARENT_OF}, so a
 * group can be deleted without taking its metrics with it. A group organizes metrics, it does not
 * own their lifecycle — deleting one simply leaves its members ungrouped.
 *
 * <p>Groups never nest, so their fully qualified name is the bare name, matching Metric.
 */
@Slf4j
public class MetricGroupRepository extends EntityRepository<MetricGroup> {
  private static final String UPDATE_FIELDS = "metrics";
  private static final String PATCH_FIELDS = "metrics";
  static final String FIELD_METRICS = "metrics";
  static final String FIELD_METRIC_COUNT = "metricCount";
  private static final int COUNT_BATCH_SIZE = 500;
  private static final int MEMBER_SCAN_BATCH_SIZE = 500;

  public MetricGroupRepository() {
    super(
        MetricGroupResource.COLLECTION_PATH,
        METRIC_GROUP,
        MetricGroup.class,
        Entity.getCollectionDAO().metricGroupDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
    renameAllowed = true;

    // Membership is exposed only by the authorized, paginated /metricGroups/{id}/metrics API.
    // The updater still carries the relationship field captured by putFields/patchFields in the
    // superclass constructor, while arbitrary GET/list callers cannot request an unbounded list.
    allowedFields.remove(FIELD_METRICS);

    fieldFetchers.put(FIELD_METRICS, this::fetchAndSetMetrics);
    fieldFetchers.put(FIELD_METRIC_COUNT, this::fetchAndSetMetricCounts);
  }

  @Override
  public void setFullyQualifiedName(MetricGroup metricGroup) {
    metricGroup.setFullyQualifiedName(metricGroup.getName());
  }

  @Override
  public void prepare(MetricGroup metricGroup, boolean update) {
    List<EntityReference> requestedMetrics = resolveMembers(metricGroup.getMetrics());
    metricGroup.setMetrics(expandRootSubtrees(requestedMetrics));
    validateAvailableMembership(metricGroup);
  }

  private List<EntityReference> resolveMembers(List<EntityReference> metrics) {
    if (nullOrEmpty(metrics)) {
      return metrics;
    }
    List<EntityReference> resolved = new ArrayList<>();
    for (EntityReference metric : metrics) {
      if (!METRIC.equals(metric.getType())) {
        throw new IllegalArgumentException(
            String.format(
                "A metric group can only contain metrics, but '%s' is a %s",
                metric.getFullyQualifiedName(), metric.getType()));
      }
      resolved.add(Entity.getEntityReference(metric, NON_DELETED));
    }
    return resolved;
  }

  private void validateAvailableMembership(MetricGroup metricGroup) {
    for (EntityReference metric : listOrEmpty(metricGroup.getMetrics())) {
      for (EntityReference existing :
          findFrom(metric.getId(), METRIC, Relationship.HAS, METRIC_GROUP)) {
        if (!referencesTargetGroup(existing, metricGroup)) {
          throw new IllegalArgumentException(
              "Metric already belongs to another Metric Group; use the bulk membership endpoint to reassign it");
        }
      }
    }
  }

  static boolean referencesTargetGroup(EntityReference existing, MetricGroup target) {
    if (target.getId() != null && target.getId().equals(existing.getId())) {
      return true;
    }
    String targetName =
        target.getFullyQualifiedName() == null ? target.getName() : target.getFullyQualifiedName();
    return targetName != null
        && (targetName.equals(existing.getFullyQualifiedName())
            || targetName.equals(existing.getName()));
  }

  private void validateMembers(List<EntityReference> metrics) {
    for (EntityReference metric : listOrEmpty(metrics)) {
      if (!METRIC.equals(metric.getType())) {
        throw new IllegalArgumentException(
            String.format(
                "A metric group can only contain metrics, but '%s' is a %s",
                metric.getFullyQualifiedName(), metric.getType()));
      }
    }
  }

  @Override
  public void setFields(
      MetricGroup metricGroup, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    metricGroup.setMetrics(
        fields.contains(FIELD_METRICS) ? getMetrics(metricGroup) : metricGroup.getMetrics());
    metricGroup.setMetricCount(
        fields.contains(FIELD_METRIC_COUNT)
            ? getMetricCount(metricGroup)
            : metricGroup.getMetricCount());
  }

  @Override
  protected void clearFields(MetricGroup metricGroup, EntityUtil.Fields fields) {
    metricGroup.setMetrics(fields.contains(FIELD_METRICS) ? metricGroup.getMetrics() : null);
    metricGroup.setMetricCount(
        fields.contains(FIELD_METRIC_COUNT) ? metricGroup.getMetricCount() : null);
  }

  private List<EntityReference> getMetrics(MetricGroup metricGroup) {
    return findTo(metricGroup.getId(), METRIC_GROUP, Relationship.HAS, METRIC);
  }

  public MetricGroup getWithMembers(UUID id, Include include) {
    MetricGroup metricGroup = get(null, id, EntityUtil.Fields.EMPTY_FIELDS, include, false);
    metricGroup.setMetrics(getMetrics(metricGroup));
    return metricGroup;
  }

  public MetricGroup getByNameWithMembers(String fullyQualifiedName, Include include) {
    MetricGroup metricGroup =
        getByName(null, fullyQualifiedName, EntityUtil.Fields.EMPTY_FIELDS, include, false);
    metricGroup.setMetrics(getMetrics(metricGroup));
    return metricGroup;
  }

  private Integer getMetricCount(MetricGroup metricGroup) {
    return ((CollectionDAO.MetricGroupDAO) dao)
        .countNonDeletedMembers(metricGroup.getId(), Relationship.HAS.ordinal());
  }

  private void fetchAndSetMetrics(List<MetricGroup> groups, EntityUtil.Fields fields) {
    if (!fields.contains(FIELD_METRICS) || nullOrEmpty(groups)) {
      return;
    }
    Map<UUID, List<EntityReference>> membersByGroup = batchFetchMembers(groups);
    for (MetricGroup group : groups) {
      group.setMetrics(membersByGroup.getOrDefault(group.getId(), new ArrayList<>()));
    }
  }

  private void fetchAndSetMetricCounts(List<MetricGroup> groups, EntityUtil.Fields fields) {
    if (!fields.contains(FIELD_METRIC_COUNT) || nullOrEmpty(groups)) {
      return;
    }
    Map<UUID, Integer> counts = new HashMap<>();
    CollectionDAO.MetricGroupDAO groupDAO = (CollectionDAO.MetricGroupDAO) dao;
    for (int start = 0; start < groups.size(); start += COUNT_BATCH_SIZE) {
      int end = Math.min(start + COUNT_BATCH_SIZE, groups.size());
      for (CollectionDAO.EntityRelationshipCount count :
          groupDAO.countNonDeletedMembersBatch(
              entityListToStrings(groups.subList(start, end)), Relationship.HAS.ordinal())) {
        counts.put(count.getId(), count.getCount());
      }
    }
    for (MetricGroup group : groups) {
      group.setMetricCount(counts.getOrDefault(group.getId(), 0));
    }
  }

  private Map<UUID, List<EntityReference>> batchFetchMembers(List<MetricGroup> groups) {
    Map<UUID, List<EntityReference>> membersByGroup = new HashMap<>();
    for (MetricGroup group : groups) {
      membersByGroup.put(group.getId(), new ArrayList<>());
    }
    for (CollectionDAO.EntityRelationshipObject record :
        daoCollection
            .relationshipDAO()
            .findToBatch(entityListToStrings(groups), Relationship.HAS.ordinal(), METRIC)) {
      membersByGroup
          .get(UUID.fromString(record.getFromId()))
          .add(
              Entity.getEntityReferenceById(
                  METRIC, UUID.fromString(record.getToId()), NON_DELETED));
    }
    return membersByGroup;
  }

  @Override
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of(FIELD_METRICS, FIELD_METRIC_COUNT);
  }

  @Override
  public void storeEntity(MetricGroup metricGroup, boolean update) {
    store(metricGroup, update);
  }

  @Override
  public void storeEntities(List<MetricGroup> entities) {
    storeMany(entities);
  }

  @Override
  public void storeRelationships(MetricGroup metricGroup) {
    for (EntityReference metric : listOrEmpty(metricGroup.getMetrics())) {
      removeOtherGroupMemberships(metric.getId(), metricGroup.getId());
      addRelationship(metricGroup.getId(), metric.getId(), METRIC_GROUP, METRIC, Relationship.HAS);
    }
  }

  @Override
  protected void postCreate(MetricGroup metricGroup) {
    super.postCreate(metricGroup);
    MembershipChange change =
        new MembershipChange(
            new ArrayList<>(listOrEmpty(metricGroup.getMetrics())),
            Set.of(metricGroup.getEntityReference()));
    publishMembershipChange(change);
  }

  @Override
  protected void postDelete(MetricGroup metricGroup, boolean hardDelete) {
    super.postDelete(metricGroup, hardDelete);
    if (!hardDelete) {
      retainMembersForPostDelete(metricGroup, getMetrics(metricGroup));
    }
    publishMembershipChange(
        new MembershipChange(
            new ArrayList<>(listOrEmpty(metricGroup.getMetrics())),
            Set.of(metricGroup.getEntityReference())));
  }

  @Override
  protected void postUpdate(MetricGroup original, MetricGroup updated) {
    super.postUpdate(original, updated);
    if (Boolean.TRUE.equals(original.getDeleted()) && !Boolean.TRUE.equals(updated.getDeleted())) {
      List<EntityReference> restoredMembers = getMetrics(updated);
      updated.setMetrics(restoredMembers);
      publishMembershipChange(
          new MembershipChange(restoredMembers, Set.of(updated.getEntityReference())));
    }
  }

  @Override
  protected void postRestoreFromSearch(MetricGroup metricGroup) {
    refreshMembersAfterGroupLifecycle(metricGroup);
  }

  @Override
  protected void entitySpecificCleanup(MetricGroup metricGroup) {
    retainMembersForPostDelete(metricGroup, getMetrics(metricGroup));
  }

  static void retainMembersForPostDelete(
      MetricGroup metricGroup, List<EntityReference> currentMembers) {
    metricGroup.setMetrics(new ArrayList<>(listOrEmpty(currentMembers)));
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<MetricGroup> entities) {
    if (entities.isEmpty()) {
      return;
    }
    // Only groups that carry an explicit member list are cleared: a null list means "unchanged"
    // on bulk import paths, and wiping those would silently empty every group in the file.
    List<UUID> memberCarryingIds =
        entities.stream()
            .filter(group -> group.getMetrics() != null)
            .map(MetricGroup::getId)
            .toList();
    deleteFromMany(memberCarryingIds, METRIC_GROUP, Relationship.HAS, METRIC);
  }

  @Override
  public EntityRepository<MetricGroup>.EntityUpdater getUpdater(
      MetricGroup original, MetricGroup updated, Operation operation, ChangeSource changeSource) {
    return new MetricGroupUpdater(original, updated, operation);
  }

  public BulkOperationResult bulkAddMetrics(String groupName, BulkAssets request, String userName) {
    MetricGroup group = getByName(null, groupName, getFields("id"));
    return updateMembership(group, request, true);
  }

  public BulkOperationResult bulkRemoveMetrics(
      String groupName, BulkAssets request, String userName) {
    MetricGroup group = getByName(null, groupName, getFields("id"));
    return updateMembership(group, request, false);
  }

  public ResultList<Metric> listMetrics(
      UUID groupId, int limit, int offset, String query, boolean rootOnly) {
    MemberScan scan = scanUnrestrictedMemberIds(groupId, limit, offset, query, rootOnly);
    return buildMetricPage(scan, limit, offset, ignored -> true);
  }

  public ResultList<Metric> listMetrics(
      UUID groupId,
      int limit,
      int offset,
      String query,
      boolean rootOnly,
      Predicate<EntityReference> isVisible) {
    CollectionDAO.MetricGroupDAO groupDAO = (CollectionDAO.MetricGroupDAO) dao;
    String nameLike = buildNameLike(query);
    MemberScan scan =
        scanMemberIds(groupDAO, groupId, limit, offset, query, nameLike, rootOnly, isVisible);
    return buildMetricPage(scan, limit, offset, isVisible);
  }

  private ResultList<Metric> buildMetricPage(
      MemberScan scan, int limit, int offset, Predicate<EntityReference> isVisible) {
    List<UUID> ids = scan.ids();
    List<Metric> metrics = daoCollection.metricDAO().findEntitiesByIds(ids, NON_DELETED);
    MetricRepository metricRepository =
        (MetricRepository) Entity.getEntityRepository(Entity.METRIC);
    metricRepository.setFieldsInBulk(
        metricRepository.getFields("owners,reviewers,parent,childrenCount,metricGroup"), metrics);
    metrics =
        metrics.stream()
            .map(
                metric ->
                    MetricRepository.sanitizeHierarchyMetric(metric, isVisible, ignored -> true))
            .collect(Collectors.toCollection(ArrayList::new));
    for (Metric metric : metrics) {
      metric.setChildrenCount(metricRepository.visibleChildCount(metric.getId(), isVisible));
    }
    Map<UUID, Integer> positions = new HashMap<>();
    for (int index = 0; index < ids.size(); index++) {
      positions.put(ids.get(index), index);
    }
    metrics.sort((left, right) -> positions.get(left.getId()) - positions.get(right.getId()));
    Paging paging = new Paging().withOffset(offset).withLimit(limit).withTotal(scan.total());
    return new ResultList<>(metrics, paging);
  }

  MemberScan scanUnrestrictedMemberIds(
      UUID groupId, int limit, int offset, String query, boolean rootOnly) {
    CollectionDAO.MetricGroupDAO groupDAO = (CollectionDAO.MetricGroupDAO) dao;
    String nameLike = buildNameLike(query);
    MemberScan result;
    if (rootOnly && hasSearchQuery(query)) {
      result =
          scanMemberIds(groupDAO, groupId, limit, offset, query, nameLike, true, ignored -> true);
    } else {
      List<EntityReference> references =
          memberReferences(groupDAO, groupId, limit, offset, nameLike, rootOnly);
      int total = countUnrestrictedMembers(groupDAO, groupId, nameLike, rootOnly);
      result = new MemberScan(references.stream().map(EntityReference::getId).toList(), total);
    }
    return result;
  }

  private int countUnrestrictedMembers(
      CollectionDAO.MetricGroupDAO groupDAO, UUID groupId, String nameLike, boolean rootOnly) {
    return rootOnly
        ? groupDAO.countRootMembersPage(
            groupId, Relationship.HAS.ordinal(), Relationship.CONTAINS.ordinal(), nameLike)
        : groupDAO.countMembers(groupId, Relationship.HAS.ordinal(), nameLike);
  }

  int visibleMetricCount(UUID groupId, Predicate<EntityReference> isVisible) {
    CollectionDAO.MetricGroupDAO groupDAO = (CollectionDAO.MetricGroupDAO) dao;
    return scanMemberIds(groupDAO, groupId, 0, 0, null, "%", false, isVisible).total();
  }

  private MemberScan scanMemberIds(
      CollectionDAO.MetricGroupDAO groupDAO,
      UUID groupId,
      int limit,
      int offset,
      String query,
      String nameLike,
      boolean rootOnly,
      Predicate<EntityReference> isVisible) {
    List<UUID> page = new ArrayList<>();
    int relationshipOffset = 0;
    int visible = 0;
    List<EntityReference> batch;
    do {
      batch =
          memberReferences(
              groupDAO,
              groupId,
              MEMBER_SCAN_BATCH_SIZE,
              relationshipOffset,
              rootOnly ? "%" : nameLike,
              rootOnly);
      for (EntityReference reference : batch) {
        if (isVisible.test(reference)
            && (!rootOnly || subtreeMatchesQuery(reference.getId(), query, isVisible))) {
          if (visible >= offset && page.size() < limit) {
            page.add(reference.getId());
          }
          visible++;
        }
      }
      relationshipOffset += batch.size();
    } while (batch.size() == MEMBER_SCAN_BATCH_SIZE);
    return new MemberScan(page, visible);
  }

  boolean hasVisibleMemberMatching(
      UUID groupId, String query, Predicate<EntityReference> isVisible) {
    CollectionDAO.MetricGroupDAO groupDAO = (CollectionDAO.MetricGroupDAO) dao;
    String nameLike = buildNameLike(query);
    int relationshipOffset = 0;
    List<EntityReference> batch;
    do {
      batch =
          memberReferences(
              groupDAO, groupId, MEMBER_SCAN_BATCH_SIZE, relationshipOffset, nameLike, false);
      for (EntityReference reference : batch) {
        if (isVisible.test(reference)) {
          return true;
        }
      }
      relationshipOffset += batch.size();
    } while (batch.size() == MEMBER_SCAN_BATCH_SIZE);
    return false;
  }

  private boolean subtreeMatchesQuery(
      UUID rootId, String query, Predicate<EntityReference> isVisible) {
    if (!hasSearchQuery(query)) {
      return true;
    }
    return expandSubtree(rootId).stream()
        .anyMatch(metric -> isVisible.test(metric) && referenceMatchesQuery(metric, query));
  }

  static boolean referenceMatchesQuery(EntityReference reference, String query) {
    if (!hasSearchQuery(query)) {
      return true;
    }
    String normalized = query.trim().toLowerCase(Locale.ROOT);
    return stringContains(reference.getName(), normalized)
        || stringContains(reference.getDisplayName(), normalized);
  }

  private static boolean stringContains(String value, String normalizedQuery) {
    return value != null && value.toLowerCase(Locale.ROOT).contains(normalizedQuery);
  }

  private static boolean hasSearchQuery(String query) {
    return !nullOrEmpty(query) && !query.trim().isEmpty();
  }

  private List<EntityReference> memberReferences(
      CollectionDAO.MetricGroupDAO groupDAO,
      UUID groupId,
      int limit,
      int offset,
      String nameLike,
      boolean rootOnly) {
    List<String> memberJsons =
        rootOnly
            ? groupDAO.listRootMemberJsonsPage(
                groupId,
                Relationship.HAS.ordinal(),
                Relationship.CONTAINS.ordinal(),
                nameLike,
                limit,
                offset)
            : groupDAO.listMemberJsons(
                groupId, Relationship.HAS.ordinal(), nameLike, limit, offset);
    return memberJsons.stream()
        .map(json -> JsonUtils.readValue(json, Metric.class).getEntityReference())
        .toList();
  }

  public List<EntityReference> hierarchySubtree(EntityReference requested) {
    return expandSubtree(resolveRootMetric(requested).getId());
  }

  private BulkOperationResult updateMembership(
      MetricGroup group, BulkAssets request, boolean isAdd) {
    boolean dryRun = Boolean.TRUE.equals(request.getDryRun());
    BulkOperationResult result = new BulkOperationResult().withDryRun(dryRun);
    List<BulkResponse> successes = new ArrayList<>();
    List<BulkResponse> failures = new ArrayList<>();
    for (EntityReference requested : listOrEmpty(request.getAssets())) {
      updateRequestedRoot(group, requested, isAdd, dryRun, result, successes, failures);
    }
    setBulkStatus(result, successes, failures);
    return result.withSuccessRequest(successes).withFailedRequest(failures);
  }

  private void updateRequestedRoot(
      MetricGroup group,
      EntityReference requested,
      boolean isAdd,
      boolean dryRun,
      BulkOperationResult result,
      List<BulkResponse> successes,
      List<BulkResponse> failures) {
    result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);
    try {
      EntityReference metric = resolveRootMetric(requested);
      if (!dryRun) {
        MembershipChange change = updateSubtreeMembership(group, metric, isAdd);
        publishMembershipChange(change);
      }
      successes.add(new BulkResponse().withRequest(requested));
      result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
    } catch (IllegalArgumentException exception) {
      failures.add(new BulkResponse().withRequest(requested).withMessage(exception.getMessage()));
      result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
    }
  }

  private EntityReference resolveRootMetric(EntityReference requested) {
    if (!METRIC.equals(requested.getType())) {
      throw new IllegalArgumentException("Metric Group membership accepts Metric entities only");
    }
    EntityReference metric = Entity.getEntityReference(requested.withType(METRIC), NON_DELETED);
    if (!findFrom(metric.getId(), METRIC, Relationship.CONTAINS, METRIC).isEmpty()) {
      throw new IllegalArgumentException(
          String.format("Metric '%s' is not a hierarchy root", metric.getFullyQualifiedName()));
    }
    return metric;
  }

  private MembershipChange updateSubtreeMembership(
      MetricGroup group, EntityReference rootMetric, boolean isAdd) {
    List<EntityReference> metrics = expandSubtree(rootMetric.getId());
    return inLockedMembershipTransaction(
        metrics,
        relationshipDAO ->
            isAdd
                ? assignHierarchyGroup(relationshipDAO, metrics, group.getEntityReference())
                : removeHierarchyGroup(relationshipDAO, metrics, group.getEntityReference()));
  }

  static MembershipChange removeHierarchyGroup(
      CollectionDAO.EntityRelationshipDAO relationshipDAO,
      List<EntityReference> metrics,
      EntityReference group) {
    UUID rootMetricId = metrics.getFirst().getId();
    boolean isMember =
        relationshipDAO
            .findFrom(rootMetricId, METRIC, Relationship.HAS.ordinal(), METRIC_GROUP)
            .stream()
            .anyMatch(existing -> existing.getId().equals(group.getId()));
    if (!isMember) {
      throw new IllegalArgumentException("Metric is not a member of the requested Metric Group");
    }
    for (EntityReference metric : metrics) {
      relationshipDAO.delete(
          group.getId(), METRIC_GROUP, metric.getId(), METRIC, Relationship.HAS.ordinal());
    }
    return new MembershipChange(metrics, Set.of(group));
  }

  static MembershipChange assignHierarchyGroup(
      CollectionDAO.EntityRelationshipDAO relationshipDAO,
      List<EntityReference> metrics,
      EntityReference group) {
    Set<EntityReference> groupsToRefresh = new LinkedHashSet<>();
    if (group != null) {
      groupsToRefresh.add(group);
    }
    for (EntityReference metric : metrics) {
      for (CollectionDAO.EntityRelationshipRecord existing :
          relationshipDAO.findFrom(
              metric.getId(), METRIC, Relationship.HAS.ordinal(), METRIC_GROUP)) {
        if (group == null || !existing.getId().equals(group.getId())) {
          relationshipDAO.delete(
              existing.getId(), METRIC_GROUP, metric.getId(), METRIC, Relationship.HAS.ordinal());
          groupsToRefresh.add(
              new EntityReference().withId(existing.getId()).withType(METRIC_GROUP));
        }
      }
      if (group != null) {
        relationshipDAO.insert(
            group.getId(), metric.getId(), METRIC_GROUP, METRIC, Relationship.HAS.ordinal());
      }
    }
    return new MembershipChange(metrics, groupsToRefresh);
  }

  MembershipChange assignHierarchyGroup(UUID rootMetricId, EntityReference group) {
    List<EntityReference> metrics = expandSubtree(rootMetricId);
    return inLockedMembershipTransaction(
        metrics, relationshipDAO -> assignHierarchyGroup(relationshipDAO, metrics, group));
  }

  private MembershipChange inLockedMembershipTransaction(
      List<EntityReference> metrics,
      java.util.function.Function<CollectionDAO.EntityRelationshipDAO, MembershipChange> update) {
    List<String> metricIds =
        metrics.stream().map(EntityReference::getId).map(UUID::toString).sorted().toList();
    return Entity.getJdbi()
        .inTransaction(
            handle -> {
              handle.attach(CollectionDAO.MetricDAO.class).lockForGroupAssignment(metricIds);
              return update.apply(handle.attach(CollectionDAO.EntityRelationshipDAO.class));
            });
  }

  void publishMembershipChange(MembershipChange change) {
    synchronizeMembershipSideEffects(change);
    refreshMemberSearchDocuments(change.metrics());
    change.groups().forEach(this::refreshGroup);
  }

  public void refreshMembersAfterGroupLifecycle(MetricGroup groupSnapshot) {
    MembershipChange change =
        new MembershipChange(
            new ArrayList<>(listOrEmpty(groupSnapshot.getMetrics())),
            Set.of(groupSnapshot.getEntityReference()));
    synchronizeMembershipSideEffects(change);
    refreshMemberSearchDocuments(change.metrics());
  }

  private void refreshMemberSearchDocuments(List<EntityReference> metrics) {
    for (EntityReference metric : metrics) {
      EntityLifecycleEventDispatcher.getInstance().onEntityUpdated(metric, null);
    }
  }

  private void synchronizeMembershipSideEffects(MembershipChange change) {
    for (EntityReference metric : change.metrics()) {
      Set<UUID> currentGroups =
          findFrom(metric.getId(), METRIC, Relationship.HAS, METRIC_GROUP).stream()
              .map(EntityReference::getId)
              .collect(Collectors.toSet());
      RequestEntityCache.invalidate(METRIC, metric.getId(), metric.getFullyQualifiedName());
      EntityRepository.invalidateCacheForEntity(
          METRIC, metric.getId(), metric.getFullyQualifiedName());
      for (EntityReference group : change.groups()) {
        EntityRelationship relationship =
            new EntityRelationship()
                .withFromId(group.getId())
                .withFromEntity(METRIC_GROUP)
                .withToId(metric.getId())
                .withToEntity(METRIC)
                .withRelationshipType(Relationship.HAS);
        if (currentGroups.contains(group.getId())) {
          RdfUpdater.addRelationship(relationship);
        } else {
          RdfUpdater.removeRelationship(relationship);
        }
      }
    }
    change
        .groups()
        .forEach(
            group -> EntityRepository.invalidateCacheForEntity(METRIC_GROUP, group.getId(), null));
  }

  private List<EntityReference> expandSubtree(UUID rootMetricId) {
    Set<UUID> metricIds = new LinkedHashSet<>();
    ArrayDeque<UUID> pending = new ArrayDeque<>(List.of(rootMetricId));
    while (!pending.isEmpty()) {
      UUID current = pending.removeFirst();
      if (metricIds.add(current)) {
        childIds(current).forEach(pending::addLast);
      }
    }
    return Entity.getEntityReferencesByIds(METRIC, new ArrayList<>(metricIds), NON_DELETED);
  }

  private List<EntityReference> removeGroupMemberships(
      UUID metricId, EntityReference retainedGroup) {
    List<EntityReference> removed = new ArrayList<>();
    for (EntityReference existing : findFrom(metricId, METRIC, Relationship.HAS, METRIC_GROUP)) {
      if (retainedGroup == null || !existing.getId().equals(retainedGroup.getId())) {
        deleteRelationship(existing.getId(), METRIC_GROUP, metricId, METRIC, Relationship.HAS);
        removed.add(existing);
      }
    }
    return removed;
  }

  private void setBulkStatus(
      BulkOperationResult result, List<BulkResponse> successes, List<BulkResponse> failures) {
    ApiStatus status = ApiStatus.SUCCESS;
    if (successes.isEmpty() && !failures.isEmpty()) {
      status = ApiStatus.FAILURE;
    } else if (!failures.isEmpty()) {
      status = ApiStatus.PARTIAL_SUCCESS;
    }
    result.setStatus(status);
  }

  private List<EntityReference> expandRootSubtrees(List<EntityReference> roots) {
    if (nullOrEmpty(roots)) {
      return roots;
    }
    List<EntityReference> hierarchyRoots =
        roots.stream()
            .filter(
                metric -> findFrom(metric.getId(), METRIC, Relationship.CONTAINS, METRIC).isEmpty())
            .toList();
    Set<UUID> metricIds = new LinkedHashSet<>();
    for (EntityReference root : hierarchyRoots) {
      expandSubtree(root.getId()).stream().map(EntityReference::getId).forEach(metricIds::add);
    }
    validateRequestedHierarchyMembers(roots, metricIds);
    return Entity.getEntityReferencesByIds(METRIC, new ArrayList<>(metricIds), NON_DELETED);
  }

  static void validateRequestedHierarchyMembers(
      List<EntityReference> requestedMetrics, Set<UUID> expandedMetricIds) {
    for (EntityReference metric : requestedMetrics) {
      if (!expandedMetricIds.contains(metric.getId())) {
        throw new IllegalArgumentException(
            String.format("Metric '%s' is not a hierarchy root", metric.getFullyQualifiedName()));
      }
    }
  }

  private List<UUID> childIds(UUID metricId) {
    return daoCollection
        .metricDAO()
        .listDescendantSeedIds(metricId, Relationship.CONTAINS.ordinal())
        .stream()
        .map(UUID::fromString)
        .toList();
  }

  private void removeOtherGroupMemberships(UUID metricId, UUID targetGroupId) {
    for (EntityReference existing : findFrom(metricId, METRIC, Relationship.HAS, METRIC_GROUP)) {
      if (!existing.getId().equals(targetGroupId)) {
        deleteRelationship(existing.getId(), METRIC_GROUP, metricId, METRIC, Relationship.HAS);
      }
    }
  }

  private void refreshGroup(EntityReference group) {
    if (group != null) {
      EntityLifecycleEventDispatcher.getInstance().onEntityUpdated(group, null);
    }
  }

  record MembershipChange(List<EntityReference> metrics, Set<EntityReference> groups) {}

  record MemberScan(List<UUID> ids, int total) {}

  static String buildNameLike(String query) {
    String result = "%";
    if (!nullOrEmpty(query)) {
      String normalized = query.trim();
      if (normalized.isEmpty()) {
        return result;
      }
      String escaped =
          normalized
              .toLowerCase(Locale.ROOT)
              .replace("!", "!!")
              .replace("%", "!%")
              .replace("_", "!_");
      result = "%" + escaped + "%";
    }
    return result;
  }

  public class MetricGroupUpdater extends EntityUpdater {
    private final Set<EntityReference> metricsToRefresh = new LinkedHashSet<>();
    private final Set<EntityReference> groupsToRefresh = new LinkedHashSet<>();

    public MetricGroupUpdater(MetricGroup original, MetricGroup updated, Operation operation) {
      super(original, updated, operation);
      metricsToRefresh.addAll(listOrEmpty(original.getMetrics()));
      metricsToRefresh.addAll(listOrEmpty(updated.getMetrics()));
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate(FIELD_METRICS, () -> updateMetrics(original, updated));
      MembershipChange change =
          new MembershipChange(
              new ArrayList<>(metricsToRefresh), new LinkedHashSet<>(groupsToRefresh));
      deferReactOperation(() -> publishMembershipChange(change));
    }

    private void updateMetrics(MetricGroup original, MetricGroup updated) {
      validateMembers(updated.getMetrics());
      List<EntityReference> expanded = new ArrayList<>(listOrEmpty(updated.getMetrics()));
      updateToRelationships(
          FIELD_METRICS,
          METRIC_GROUP,
          original.getId(),
          Relationship.HAS,
          METRIC,
          new ArrayList<>(listOrEmpty(original.getMetrics())),
          new ArrayList<>(expanded),
          false);
      groupsToRefresh.add(updated.getEntityReference());
      for (EntityReference metric : expanded) {
        groupsToRefresh.addAll(
            removeGroupMemberships(metric.getId(), original.getEntityReference()));
      }
    }
  }
}
