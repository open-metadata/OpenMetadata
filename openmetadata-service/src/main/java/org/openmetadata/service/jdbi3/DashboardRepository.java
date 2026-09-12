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
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.CHART;
import static org.openmetadata.service.Entity.DASHBOARD;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityBatchFields;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.dashboards.DashboardResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository()
public class DashboardRepository implements EntityPolicy<Dashboard> {

  private static final String DASHBOARD_UPDATE_FIELDS = "charts,dataModels";

  private static final String DASHBOARD_PATCH_FIELDS = "charts,dataModels";

  private static final String DASHBOARD_URL = "sourceUrl";

  public DashboardRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                DashboardResource.COLLECTION_PATH,
                Entity.DASHBOARD,
                Dashboard.class,
                Entity.getCollectionDAO().dashboardDAO()),
            new EntityPolicyContext.WriteFields(
                DASHBOARD_PATCH_FIELDS, DASHBOARD_UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    // Covered by the parent service delete cascade: search docs by service.id
    // (SearchRepository.deleteOrUpdateChildren) and field_relationship / tag_usage by
    // the root cleanup() FQN prefix. See EntityRepository#descendantsCoveredByAncestorCascade.
    context().options().setDescendantsCoveredByAncestorCascade(true);
    fieldLoading().register("charts", this::fetchAndSetCharts);
    fieldLoading().register("dataModels", this::fetchAndSetDataModels);
    fieldLoading().register("usageSummary", this::fetchAndSetUsageSummaries);
  }

  @Override
  public void setFullyQualifiedName(Dashboard dashboard) {
    dashboard.setFullyQualifiedName(
        FullyQualifiedName.add(
            dashboard.getService().getFullyQualifiedName(), dashboard.getName()));
  }

  @Override
  public void setFields(Dashboard dashboard, Fields fields, RelationIncludes relationIncludes) {
    dashboard.setService(relationships().container(dashboard.getId(), null));
    dashboard.setCharts(
        fields.contains("charts")
            ? getRelatedEntities(dashboard, Entity.CHART, relationIncludes.getIncludeFor("charts"))
            : null);
    dashboard.setDataModels(
        fields.contains("dataModels")
            ? getRelatedEntities(
                dashboard,
                Entity.DASHBOARD_DATA_MODEL,
                relationIncludes.getIncludeFor("dataModels"))
            : null);
    if (dashboard.getUsageSummary() == null) {
      dashboard.withUsageSummary(
          fields.contains("usageSummary")
              ? EntityUtil.getLatestUsage(
                  context().dependencies().daos().usageDAO(), dashboard.getId())
              : null);
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Dashboard> entities) {
    // Service reference (incl. FQN/name) is part of default response contract for list/get.
    fetchAndSetDefaultService(entities, true);
    fieldLoading().populate(entities, fields);
    fetchAndSetDashboardSpecificFields(entities, fields);
    setInheritedFields(entities, fields);
    for (Dashboard entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  private void fetchAndSetDashboardSpecificFields(List<Dashboard> dashboards, Fields fields) {
    if (dashboards == null || dashboards.isEmpty()) {
      return;
    }
    if (fields.contains("charts")) {
      fetchAndSetCharts(dashboards, fields);
    }
    if (fields.contains("dataModels")) {
      fetchAndSetDataModels(dashboards, fields);
    }
    if (fields.contains("usageSummary")) {
      fetchAndSetUsageSummaries(dashboards, fields);
    }
  }

  private void fetchAndSetCharts(List<Dashboard> dashboards, Fields fields) {
    if (!fields.contains("charts") || dashboards == null || dashboards.isEmpty()) {
      return;
    }
    EntityBatchFields.assign(true, dashboards, batchFetchCharts(dashboards), Dashboard::setCharts);
  }

  private void fetchAndSetDataModels(List<Dashboard> dashboards, Fields fields) {
    if (!fields.contains("dataModels") || dashboards == null || dashboards.isEmpty()) {
      return;
    }
    EntityBatchFields.assign(
        true, dashboards, batchFetchDataModels(dashboards), Dashboard::setDataModels);
  }

  private void fetchAndSetUsageSummaries(List<Dashboard> dashboards, Fields fields) {
    if (!fields.contains("usageSummary") || dashboards == null || dashboards.isEmpty()) {
      return;
    }
    EntityBatchFields.assign(
        true,
        dashboards,
        EntityUtil.getLatestUsageForEntities(
            context().dependencies().daos().usageDAO(), EntityBatchFields.ids(dashboards)),
        Dashboard::setUsageSummary);
  }

  @Override
  public void clearFields(Dashboard dashboard, Fields fields) {
    dashboard.setCharts(fields.contains("charts") ? dashboard.getCharts() : null);
    dashboard.setDataModels(fields.contains("dataModels") ? dashboard.getDataModels() : null);
    dashboard.withUsageSummary(
        fields.contains("usageSummary") ? dashboard.getUsageSummary() : null);
  }

  // Hard-delete chart links (HAS relation). The CONTAINS subtree is handled by the bulk
  // path in EntityRepository.bulkHardDeleteSubtree; chart handling is a per-dashboard concern
  // and lives in the per-entity extension hook so it runs both for direct dashboard deletes
  // and when dashboards are descendants of a larger hard-delete cascade.
  @Transaction
  @Override
  public void hardDeleteAdditionalChildren(UUID dashboardId, String updatedBy) {
    cascadeChartCleanup(dashboardId, updatedBy, true);
  }

  // Soft-delete chart links (HAS relation). The CONTAINS subtree is handled by the bulk
  // path in EntityRepository.bulkSoftDeleteSubtree; chart handling is a per-dashboard
  // concern and lives in the per-entity extension hook so it runs both for direct dashboard
  // deletes and when dashboards are descendants of a larger soft-delete (e.g.,
  // DashboardService cascade).
  @Transaction
  @Override
  public void softDeleteAdditionalChildren(UUID dashboardId, String updatedBy) {
    cascadeChartCleanup(dashboardId, updatedBy, false);
  }

  private void cascadeChartCleanup(UUID dashboardId, String updatedBy, boolean hardDelete) {
    List<CollectionDAO.EntityRelationshipRecord> chartRecords =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findTo(dashboardId, DASHBOARD, Relationship.HAS.ordinal(), CHART);
    if (chartRecords.isEmpty()) {
      return;
    }
    List<CollectionDAO.EntityRelationshipObject> dashboardRelationships =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(
                chartRecords.stream()
                    .map(record -> record.getId().toString())
                    .distinct()
                    .collect(Collectors.toList()),
                Relationship.HAS.ordinal(),
                DASHBOARD);
    Set<UUID> nonDeletedDashboards =
        context()
            .dependencies()
            .daos()
            .dashboardDAO()
            .findEntitiesByIds(
                dashboardRelationships.stream()
                    .map(rel -> UUID.fromString(rel.getFromId()))
                    .distinct()
                    .collect(Collectors.toList()),
                Include.NON_DELETED)
            .stream()
            .map(Dashboard::getId)
            .filter(id -> !id.equals(dashboardId))
            .collect(Collectors.toSet());
    // Soft-delete charts whose only remaining dashboard is the one being deleted.
    List<CollectionDAO.EntityRelationshipRecord> filteredChartRecordsToBeDeleted =
        new ArrayList<>();
    for (CollectionDAO.EntityRelationshipRecord record : chartRecords) {
      UUID chartId = record.getId();
      boolean hasOtherNonDeletedDashboard = false;
      for (CollectionDAO.EntityRelationshipObject rel : dashboardRelationships) {
        UUID relFromId = UUID.fromString(rel.getFromId());
        UUID relToId = UUID.fromString(rel.getToId());
        if (relToId.equals(chartId) && nonDeletedDashboards.contains(relFromId)) {
          hasOtherNonDeletedDashboard = true;
          break;
        }
      }
      if (!hasOtherNonDeletedDashboard) {
        filteredChartRecordsToBeDeleted.add(record);
      }
    }
    deleteChildren(filteredChartRecordsToBeDeleted, hardDelete, updatedBy);
  }

  // Restore chart links (HAS relation). The CONTAINS subtree is now restored by the bulk
  // path in EntityRepository.bulkRestoreSubtree; chart handling is a per-dashboard concern
  // and lives in the per-entity extension hook.
  @Transaction
  @Override
  public void restoreAdditionalChildren(UUID dashboardId, String updatedBy) {
    List<CollectionDAO.EntityRelationshipRecord> chartRecords =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findTo(dashboardId, DASHBOARD, Relationship.HAS.ordinal(), CHART);
    if (chartRecords.isEmpty()) {
      return;
    }
    List<CollectionDAO.EntityRelationshipObject> dashboardRelationships =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(
                chartRecords.stream()
                    .map(record -> record.getId().toString())
                    .distinct()
                    .collect(Collectors.toList()),
                Relationship.HAS.ordinal(),
                DASHBOARD);
    Set<UUID> deletedDashboards =
        context()
            .dependencies()
            .daos()
            .dashboardDAO()
            .findEntitiesByIds(
                dashboardRelationships.stream()
                    .map(rel -> UUID.fromString(rel.getFromId()))
                    .distinct()
                    .collect(Collectors.toList()),
                Include.DELETED)
            .stream()
            .map(Dashboard::getId)
            .filter(id -> !id.equals(dashboardId))
            .collect(Collectors.toSet());
    List<CollectionDAO.EntityRelationshipRecord> filteredChartRecordsToBeRestored =
        new ArrayList<>();
    for (CollectionDAO.EntityRelationshipRecord chartRecord : chartRecords) {
      UUID chartId = chartRecord.getId();
      boolean hasOtherDeletedDashboard = false;
      for (CollectionDAO.EntityRelationshipObject relationship : dashboardRelationships) {
        UUID relFromId = UUID.fromString(relationship.getFromId());
        UUID relToId = UUID.fromString(relationship.getToId());
        if (relToId.equals(chartId) && deletedDashboards.contains(relFromId)) {
          hasOtherDeletedDashboard = true;
          break;
        }
      }
      if (!hasOtherDeletedDashboard) {
        filteredChartRecordsToBeRestored.add(chartRecord);
      }
    }
    // Per-chart restore preserves the full chart restoreEntity flow (setFieldsInternal,
    // setInheritedFields, lifecycle hooks, ES restore-from-search). Charts are typically
    // few per dashboard, so the loop isn't a hot path; the bulkRestoreSubtree shortcut
    // skipped chart-specific setup that the test in DashboardResourceIT relies on.
    for (CollectionDAO.EntityRelationshipRecord record : filteredChartRecordsToBeRestored) {
      LOG.info("Recursively restoring {} {}", record.getType(), record.getId());
      try {
        Entity.restoreEntity(updatedBy, record.getType(), record.getId());
      } catch (RuntimeException e) {
        // Surface the underlying cause — Entity.restoreEntity has no try/catch wrapper of
        // its own and silently aborts the whole dashboard restore if a single chart fails.
        LOG.error(
            "[ChartRestoreCascade] Failed to restore chart {} for dashboard {}: {}",
            record.getId(),
            dashboardId,
            e.getMessage(),
            e);
        throw e;
      }
    }
  }

  @Override
  public void restorePatchAttributes(Dashboard original, Dashboard updated) {
    // Patch can't make changes to following fields. Ignore the changes
    EntityPolicy.super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  private void populateService(Dashboard dashboard) {
    var service =
        (DashboardService) getCachedParentOrLoad(dashboard.getService(), "", Include.NON_DELETED);
    dashboard.setService(service.getEntityReference());
    dashboard.setServiceType(service.getServiceType());
  }

  @Override
  public void prepare(Dashboard dashboard, boolean update) {
    populateService(dashboard);
    dashboard.setCharts(EntityUtil.getEntityReferences(dashboard.getCharts(), Include.NON_DELETED));
    dashboard.setDataModels(
        EntityUtil.getEntityReferences(dashboard.getDataModels(), Include.NON_DELETED));
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service", "charts", "dataModels");
  }

  @Override
  public void storeEntity(Dashboard dashboard, boolean update) {
    persistence().store(dashboard, update);
  }

  @Override
  public void storeEntities(List<Dashboard> dashboards) {
    persistence().insertMany(dashboards);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<Dashboard> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Dashboard::getId).toList();
    deleteToMany(ids, context().schema().entityType(), Relationship.CONTAINS, null);
    deleteFromMany(ids, Entity.DASHBOARD, Relationship.HAS, Entity.CHART);
    deleteFromMany(ids, Entity.DASHBOARD, Relationship.HAS, Entity.DASHBOARD_DATA_MODEL);
  }

  @Override
  public void storeRelationships(Dashboard dashboard) {
    addServiceRelationship(dashboard, dashboard.getService());
    // Add relationship from dashboard to chart
    for (EntityReference chart : listOrEmpty(dashboard.getCharts())) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  dashboard.getId(),
                  chart.getId(),
                  Entity.DASHBOARD,
                  Entity.CHART,
                  Relationship.HAS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    // Add relationship from dashboard to data models
    for (EntityReference dataModel : listOrEmpty(dashboard.getDataModels())) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  dashboard.getId(),
                  dataModel.getId(),
                  Entity.DASHBOARD,
                  Entity.DASHBOARD_DATA_MODEL,
                  Relationship.HAS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  @Override
  public void storeEntitySpecificRelationshipsForMany(List<Dashboard> entities) {
    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (Dashboard dashboard : entities) {
      EntityReference service = dashboard.getService();
      if (service != null && service.getId() != null) {
        relationships.add(
            newRelationship(
                service.getId(),
                dashboard.getId(),
                service.getType(),
                context().schema().entityType(),
                Relationship.CONTAINS));
      }
      for (EntityReference chart : listOrEmpty(dashboard.getCharts())) {
        if (chart.getId() == null) {
          continue;
        }
        relationships.add(
            newRelationship(
                dashboard.getId(),
                chart.getId(),
                Entity.DASHBOARD,
                Entity.CHART,
                Relationship.HAS));
      }
      for (EntityReference dataModel : listOrEmpty(dashboard.getDataModels())) {
        if (dataModel.getId() == null) {
          continue;
        }
        relationships.add(
            newRelationship(
                dashboard.getId(),
                dataModel.getId(),
                Entity.DASHBOARD,
                Entity.DASHBOARD_DATA_MODEL,
                Relationship.HAS));
      }
    }
    bulkInsertRelationships(relationships);
  }

  @Override
  public EntityUpdater<Dashboard> getUpdater(
      Dashboard original, Dashboard updated, EntityOperation operation, ChangeSource changeSource) {
    return new DashboardUpdater(original, updated, operation).mutation();
  }

  @Override
  public EntityReference getParentReference(Dashboard entity) {
    return entity.getService();
  }

  @Override
  public EntityInterface getParentEntity(Dashboard entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  private List<EntityReference> getRelatedEntities(
      Dashboard dashboard, String entityType, Include include) {
    return dashboard == null
        ? Collections.emptyList()
        : relationships()
            .to(
                new EntityRelationshipReader.Selection(
                    dashboard.getId(), Entity.DASHBOARD, Relationship.HAS, entityType),
                include);
  }

  private Map<UUID, List<EntityReference>> batchFetchCharts(List<Dashboard> dashboards) {
    Map<UUID, List<EntityReference>> chartsMap = new HashMap<>();
    if (dashboards == null || dashboards.isEmpty()) {
      return chartsMap;
    }
    // Initialize empty lists for all dashboards
    for (Dashboard dashboard : dashboards) {
      chartsMap.put(dashboard.getId(), new ArrayList<>());
    }
    // Single batch query to get all charts for all dashboards
    List<CollectionDAO.EntityRelationshipObject> records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findToBatch(entityListToStrings(dashboards), Relationship.HAS.ordinal(), Entity.CHART);
    Set<UUID> chartIds = new HashSet<>();
    for (CollectionDAO.EntityRelationshipObject record : records) {
      chartIds.add(UUID.fromString(record.getToId()));
    }
    Map<UUID, EntityReference> chartRefs =
        batchFetchReferencesById(Entity.CHART, chartIds, NON_DELETED);
    // Group charts by dashboard ID
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID dashboardId = UUID.fromString(record.getFromId());
      EntityReference chartRef = chartRefs.get(UUID.fromString(record.getToId()));
      if (chartRef != null) {
        chartsMap.get(dashboardId).add(chartRef);
      }
    }
    return chartsMap;
  }

  private Map<UUID, List<EntityReference>> batchFetchDataModels(List<Dashboard> dashboards) {
    Map<UUID, List<EntityReference>> dataModelsMap = new HashMap<>();
    if (dashboards == null || dashboards.isEmpty()) {
      return dataModelsMap;
    }
    // Initialize empty lists for all dashboards
    for (Dashboard dashboard : dashboards) {
      dataModelsMap.put(dashboard.getId(), new ArrayList<>());
    }
    // Single batch query to get all data models for all dashboards
    List<CollectionDAO.EntityRelationshipObject> records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findToBatch(
                entityListToStrings(dashboards),
                Relationship.HAS.ordinal(),
                Entity.DASHBOARD_DATA_MODEL);
    Set<UUID> dataModelIds = new HashSet<>();
    for (CollectionDAO.EntityRelationshipObject record : records) {
      dataModelIds.add(UUID.fromString(record.getToId()));
    }
    Map<UUID, EntityReference> dataModelRefs =
        batchFetchReferencesById(Entity.DASHBOARD_DATA_MODEL, dataModelIds, NON_DELETED);
    // Group data models by dashboard ID
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID dashboardId = UUID.fromString(record.getFromId());
      EntityReference dataModelRef = dataModelRefs.get(UUID.fromString(record.getToId()));
      if (dataModelRef != null) {
        dataModelsMap.get(dashboardId).add(dataModelRef);
      }
    }
    return dataModelsMap;
  }

  private void fetchAndSetDefaultService(List<Dashboard> dashboards, boolean includeDetails) {
    if (dashboards == null || dashboards.isEmpty()) {
      return;
    }
    List<Dashboard> dashboardsMissingService =
        dashboards.stream()
            .filter(
                dashboard -> {
                  EntityReference service = dashboard.getService();
                  if (service == null || service.getId() == null) {
                    return true;
                  }
                  return includeDetails
                      && (service.getFullyQualifiedName() == null || service.getName() == null);
                })
            .toList();
    if (dashboardsMissingService.isEmpty()) {
      return;
    }
    // Batch fetch service references for dashboards missing parent refs.
    Map<UUID, EntityReference> serviceMap =
        batchFetchServices(dashboardsMissingService, includeDetails);
    for (Dashboard dashboard : dashboardsMissingService) {
      EntityReference serviceRef = serviceMap.get(dashboard.getId());
      if (serviceRef != null) {
        dashboard.setService(serviceRef);
      }
    }
  }

  private Map<UUID, EntityReference> batchFetchServices(
      List<Dashboard> dashboards, boolean includeDetails) {
    Map<UUID, EntityReference> serviceMap = new HashMap<>();
    if (dashboards == null || dashboards.isEmpty()) {
      return serviceMap;
    }
    // Single batch query to get all services for all dashboards
    List<CollectionDAO.EntityRelationshipObject> records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(entityListToStrings(dashboards), Relationship.CONTAINS.ordinal());
    for (CollectionDAO.EntityRelationshipObject record : records) {
      if (record.getFromId() == null
          || record.getFromEntity() == null
          || record.getToId() == null) {
        continue;
      }
      UUID dashboardId = UUID.fromString(record.getToId());
      EntityReference serviceRef;
      if (includeDetails) {
        serviceRef = null;
      } else {
        serviceRef =
            new EntityReference()
                .withId(UUID.fromString(record.getFromId()))
                .withType(record.getFromEntity());
      }
      if (serviceRef != null) {
        serviceMap.put(dashboardId, serviceRef);
      }
    }
    if (includeDetails) {
      Map<String, Set<UUID>> serviceIdsByType = new HashMap<>();
      for (CollectionDAO.EntityRelationshipObject record : records) {
        if (record.getFromEntity() == null || record.getFromId() == null) {
          continue;
        }
        serviceIdsByType
            .computeIfAbsent(record.getFromEntity(), ignored -> new HashSet<>())
            .add(UUID.fromString(record.getFromId()));
      }
      Map<String, Map<UUID, EntityReference>> serviceRefsByType =
          batchFetchReferencesByType(serviceIdsByType, NON_DELETED);
      for (CollectionDAO.EntityRelationshipObject record : records) {
        Map<UUID, EntityReference> refsForType = serviceRefsByType.get(record.getFromEntity());
        if (refsForType == null) {
          continue;
        }
        EntityReference serviceRef = refsForType.get(UUID.fromString(record.getFromId()));
        if (serviceRef != null) {
          serviceMap.put(UUID.fromString(record.getToId()), serviceRef);
        }
      }
    }
    return serviceMap;
  }

  private Map<UUID, EntityReference> batchFetchReferencesById(
      String referenceType, Set<UUID> ids, Include include) {
    if (ids == null || ids.isEmpty()) {
      return Collections.emptyMap();
    }
    List<EntityReference> refs =
        Entity.getEntityReferencesByIds(referenceType, new ArrayList<>(ids), include);
    return refs.stream()
        .collect(Collectors.toMap(EntityReference::getId, ref -> ref, (left, right) -> left));
  }

  private Map<String, Map<UUID, EntityReference>> batchFetchReferencesByType(
      Map<String, Set<UUID>> idsByType, Include include) {
    if (idsByType == null || idsByType.isEmpty()) {
      return Collections.emptyMap();
    }
    Map<String, Map<UUID, EntityReference>> refsByType = new HashMap<>();
    for (Map.Entry<String, Set<UUID>> entry : idsByType.entrySet()) {
      refsByType.put(
          entry.getKey(), batchFetchReferencesById(entry.getKey(), entry.getValue(), include));
    }
    return refsByType;
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class DashboardUpdater implements EntitySpecificMutation<Dashboard> {

    public DashboardUpdater(Dashboard original, Dashboard updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Dashboard> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "charts",
          () ->
              update(
                  Entity.CHART,
                  "charts",
                  listOrEmpty(entityUpdate.getUpdated().getCharts()),
                  listOrEmpty(entityUpdate.getOriginal().getCharts())));
      entityUpdate.compareAndUpdate(
          "dataModels",
          () ->
              update(
                  Entity.DASHBOARD_DATA_MODEL,
                  "dataModels",
                  listOrEmpty(entityUpdate.getUpdated().getDataModels()),
                  listOrEmpty(entityUpdate.getOriginal().getDataModels())));
      entityUpdate.compareAndUpdate(
          "sourceUrl",
          () -> updateDashboardUrl(entityUpdate.getOriginal(), entityUpdate.getUpdated()));
      entityUpdate.compareAndUpdate(
          "sourceHash",
          () ->
              entityUpdate.recordChange(
                  "sourceHash",
                  entityUpdate.getOriginal().getSourceHash(),
                  entityUpdate.getUpdated().getSourceHash(),
                  false,
                  EntityUtil.objectMatch,
                  false));
    }

    private void update(
        String entityType,
        String field,
        List<EntityReference> updEntities,
        List<EntityReference> oriEntities) {
      // Remove all entity type associated with this dashboard
      relationshipWrites()
          .deleteOutgoing(
              new EntityRelationshipWriter.Selection(
                  entityUpdate.getUpdated().getId(),
                  Entity.DASHBOARD,
                  Relationship.HAS,
                  entityType));
      // Add relationship from dashboard to entity type
      for (EntityReference entity : updEntities) {
        relationshipWrites()
            .add(
                new EntityRelationshipWriter.Edge(
                    entityUpdate.getUpdated().getId(),
                    entity.getId(),
                    Entity.DASHBOARD,
                    entityType,
                    Relationship.HAS),
                EntityRelationshipWriter.Value.EMPTY,
                false);
      }
      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      entityUpdate.recordListChange(
          field, oriEntities, updEntities, added, deleted, EntityUtil.entityReferenceMatch);
    }

    public void updateDashboardUrl(Dashboard original, Dashboard updated) {
      entityUpdate.recordChange(DASHBOARD_URL, original.getSourceUrl(), updated.getSourceUrl());
    }

    private final EntityUpdater<Dashboard> entityUpdate;

    public EntityUpdater<Dashboard> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<Dashboard> entityContext;

  @Override
  public final EntityPolicyContext<Dashboard> context() {
    return entityContext;
  }
}
