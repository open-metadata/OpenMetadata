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

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Chart;
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
import org.openmetadata.service.entity.write.EntityColumnMutation;
import org.openmetadata.service.entity.write.EntityColumnUpdater;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.charts.ChartResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository()
public class ChartRepository implements EntityPolicy<Chart> {

  private static final String CHART_UPDATE_FIELDS = "dashboards";

  private static final String CHART_PATCH_FIELDS = "dashboards";

  public ChartRepository() {
    this(true);
  }

  protected ChartRepository(boolean registerEntity) {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                ChartResource.COLLECTION_PATH,
                Entity.CHART,
                Chart.class,
                Entity.getCollectionDAO().chartDAO()),
            new EntityPolicyContext.WriteFields(CHART_PATCH_FIELDS, CHART_UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, registerEntity);
    context().options().setSupportsSearch(true);
    // Covered by the parent service delete cascade: search docs by service.id
    // (SearchRepository.deleteOrUpdateChildren) and field_relationship / tag_usage by
    // the root cleanup() FQN prefix. See EntityRepository#descendantsCoveredByAncestorCascade.
    context().options().setDescendantsCoveredByAncestorCascade(true);
    // Register bulk field fetchers for efficient database operations
    fieldLoading().register("dashboards", this::fetchAndSetDashboards);
    // NOTE: "service" field is NOT registered here because:
    // - For bulk operations: fetchAndSetDefaultService() in setFieldsInBulk handles it correctly
    // - For single entity: setFields() already sets service via getContainer()
  }

  @Override
  public void setFullyQualifiedName(Chart chart) {
    chart.setFullyQualifiedName(
        FullyQualifiedName.add(chart.getService().getFullyQualifiedName(), chart.getName()));
  }

  @Override
  public void prepare(Chart chart, boolean update) {
    var dashboardService =
        (DashboardService) getCachedParentOrLoad(chart.getService(), "", Include.ALL);
    chart.setService(dashboardService.getEntityReference());
    chart.setServiceType(dashboardService.getServiceType());
    chart.setDashboards(EntityUtil.getEntityReferences(chart.getDashboards(), Include.NON_DELETED));
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service", "dashboards");
  }

  @Override
  public void storeEntity(Chart chart, boolean update) {
    persistence().store(chart, update);
  }

  @Override
  public void storeEntities(List<Chart> charts) {
    persistence().insertMany(charts);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<Chart> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Chart::getId).toList();
    deleteToMany(ids, context().schema().entityType(), Relationship.CONTAINS, null);
    deleteToMany(ids, Entity.CHART, Relationship.HAS, Entity.DASHBOARD);
  }

  @Override
  @SneakyThrows
  public void storeRelationships(Chart chart) {
    addServiceRelationship(chart, chart.getService());
    // Add relationship from dashboard to chart
    for (EntityReference dashboard : listOrEmpty(chart.getDashboards())) {
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
  }

  @Override
  public void storeEntitySpecificRelationshipsForMany(List<Chart> entities) {
    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (Chart chart : entities) {
      EntityReference service = chart.getService();
      if (service != null && service.getId() != null) {
        relationships.add(
            newRelationship(
                service.getId(),
                chart.getId(),
                service.getType(),
                context().schema().entityType(),
                Relationship.CONTAINS));
      }
      for (EntityReference dashboard : listOrEmpty(chart.getDashboards())) {
        if (dashboard.getId() == null) {
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
    }
    bulkInsertRelationships(relationships);
  }

  @Override
  public void setFields(Chart chart, Fields fields, RelationIncludes relationIncludes) {
    chart.withService(relationships().container(chart.getId(), null));
    // Use Include.ALL for dashboards to match legacy behavior - dashboard-chart relationship
    // should show all associated dashboards regardless of delete status to maintain referential
    // integrity
    chart.setDashboards(
        fields.contains("dashboards")
            ? getRelatedEntities(chart, Entity.DASHBOARD, Include.ALL)
            : null);
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Chart> entities) {
    fetchAndSetDefaultService(entities);
    fieldLoading().populate(entities, fields);
    setInheritedFields(entities, fields);
    for (Chart entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  // Individual field fetchers registered in constructor
  private void fetchAndSetDashboards(List<Chart> charts, Fields fields) {
    if (!fields.contains("dashboards") || charts == null || charts.isEmpty()) {
      return;
    }
    EntityBatchFields.assign(true, charts, batchFetchDashboards(charts), Chart::setDashboards);
  }

  @Override
  public void clearFields(Chart chart, Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void restorePatchAttributes(Chart original, Chart updated) {
    // Patch can't make changes to following fields. Ignore the changes
    EntityPolicy.super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  public EntityUpdater<Chart> getUpdater(
      Chart original, Chart updated, EntityOperation operation, ChangeSource changeSource) {
    return new ChartUpdater(original, updated, operation).mutation();
  }

  @Override
  public EntityReference getParentReference(Chart entity) {
    return entity.getService();
  }

  @Override
  public EntityInterface getParentEntity(Chart entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  private List<EntityReference> getRelatedEntities(
      Chart chart, String entityType, Include include) {
    return chart == null
        ? Collections.emptyList()
        : relationships()
            .from(
                new EntityRelationshipReader.Selection(
                    chart.getId(), Entity.CHART, Relationship.HAS, entityType),
                include);
  }

  public class ChartUpdater implements EntityColumnMutation<Chart> {

    public ChartUpdater(Chart chart, Chart updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(chart, updated, operation, null, false),
              this);
      this.columnUpdate = new EntityColumnUpdater<>(entityUpdate, this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Chart> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "chartType",
          () ->
              entityUpdate.recordChange(
                  "chartType",
                  entityUpdate.getOriginal().getChartType(),
                  entityUpdate.getUpdated().getChartType()));
      entityUpdate.compareAndUpdate(
          "sourceUrl",
          () ->
              entityUpdate.recordChange(
                  "sourceUrl",
                  entityUpdate.getOriginal().getSourceUrl(),
                  entityUpdate.getUpdated().getSourceUrl()));
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
      entityUpdate.compareAndUpdate(
          "dashboards",
          () ->
              update(
                  Entity.DASHBOARD,
                  "dashboards",
                  listOrEmpty(entityUpdate.getUpdated().getDashboards()),
                  listOrEmpty(entityUpdate.getOriginal().getDashboards())));
    }

    private void update(
        String entityType,
        String field,
        List<EntityReference> updEntities,
        List<EntityReference> oriEntities) {
      // Remove all entity type associated with this dashboard
      relationshipWrites()
          .deleteIncoming(
              new EntityRelationshipWriter.Selection(
                  entityUpdate.getUpdated().getId(), Entity.CHART, Relationship.HAS, entityType));
      // Add relationship from dashboard to chart type
      for (EntityReference entity : updEntities) {
        relationshipWrites()
            .add(
                new EntityRelationshipWriter.Edge(
                    entity.getId(),
                    entityUpdate.getUpdated().getId(),
                    entityType,
                    Entity.CHART,
                    Relationship.HAS),
                EntityRelationshipWriter.Value.EMPTY,
                false);
      }
      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      entityUpdate.recordListChange(
          field, oriEntities, updEntities, added, deleted, EntityUtil.entityReferenceMatch);
    }

    private final EntityUpdater<Chart> entityUpdate;

    public EntityUpdater<Chart> mutation() {
      return entityUpdate;
    }

    private final EntityColumnUpdater<Chart> columnUpdate;
  }

  private Map<UUID, List<EntityReference>> batchFetchDashboards(List<Chart> charts) {
    var dashboardsMap = new HashMap<UUID, List<EntityReference>>();
    if (charts == null || charts.isEmpty()) {
      return dashboardsMap;
    }
    // Initialize empty lists for all charts
    charts.forEach(chart -> dashboardsMap.put(chart.getId(), new ArrayList<>()));
    // Single batch query to get all dashboards for all charts
    // Use Include.ALL to get all relationships including those for soft-deleted entities
    var records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(entityListToStrings(charts), Relationship.HAS.ordinal(), Include.ALL);
    // Collect all unique dashboard IDs first
    var dashboardIds =
        records.stream()
            .filter(rec -> Entity.DASHBOARD.equals(rec.getFromEntity()))
            .map(rec -> UUID.fromString(rec.getFromId()))
            .distinct()
            .toList();
    // Batch fetch all dashboard entity references
    var dashboardRefs =
        Entity.getEntityReferencesByIds(Entity.DASHBOARD, dashboardIds, Include.ALL);
    var dashboardRefMap =
        dashboardRefs.stream().collect(Collectors.toMap(EntityReference::getId, ref -> ref));
    // Group dashboards by chart ID
    records.forEach(
        record -> {
          if (Entity.DASHBOARD.equals(record.getFromEntity())) {
            var chartId = UUID.fromString(record.getToId());
            var dashboardId = UUID.fromString(record.getFromId());
            var dashboardRef = dashboardRefMap.get(dashboardId);
            if (dashboardRef != null) {
              dashboardsMap.get(chartId).add(dashboardRef);
            }
          }
        });
    return dashboardsMap;
  }

  private void fetchAndSetDefaultService(List<Chart> charts) {
    if (charts == null || charts.isEmpty()) {
      return;
    }
    // Batch fetch service references for all charts
    Map<UUID, EntityReference> serviceMap = batchFetchServices(charts);
    // Set service for all charts
    for (Chart chart : charts) {
      chart.setService(serviceMap.get(chart.getId()));
    }
  }

  private Map<UUID, EntityReference> batchFetchServices(List<Chart> charts) {
    var serviceMap = new HashMap<UUID, EntityReference>();
    if (charts == null || charts.isEmpty()) {
      return serviceMap;
    }
    // Single batch query to get all services for all charts
    // Use Include.ALL to get all relationships including those for soft-deleted entities
    var records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(charts), Relationship.CONTAINS.ordinal(), Include.ALL);
    // Collect all unique service IDs first
    var serviceIds =
        records.stream()
            .filter(rec -> Entity.DASHBOARD_SERVICE.equals(rec.getFromEntity()))
            .map(rec -> UUID.fromString(rec.getFromId()))
            .distinct()
            .toList();
    // Batch fetch all service entity references
    var serviceRefs =
        Entity.getEntityReferencesByIds(Entity.DASHBOARD_SERVICE, serviceIds, Include.ALL);
    var serviceRefMap =
        serviceRefs.stream().collect(Collectors.toMap(EntityReference::getId, ref -> ref));
    // Map charts to their services
    records.forEach(
        record -> {
          if (Entity.DASHBOARD_SERVICE.equals(record.getFromEntity())) {
            var chartId = UUID.fromString(record.getToId());
            var serviceId = UUID.fromString(record.getFromId());
            var serviceRef = serviceRefMap.get(serviceId);
            if (serviceRef != null) {
              serviceMap.put(chartId, serviceRef);
            }
          }
        });
    return serviceMap;
  }

  private final EntityPolicyContext<Chart> entityContext;

  @Override
  public final EntityPolicyContext<Chart> context() {
    return entityContext;
  }
}
