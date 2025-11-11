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
import org.openmetadata.service.resources.charts.ChartResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class ChartRepository extends EntityRepository<Chart> {

  private static final String CHART_UPDATE_FIELDS = "dashboards";
  private static final String CHART_PATCH_FIELDS = "dashboards";

  public ChartRepository() {
    super(
        ChartResource.COLLECTION_PATH,
        Entity.CHART,
        Chart.class,
        Entity.getCollectionDAO().chartDAO(),
        CHART_PATCH_FIELDS,
        CHART_UPDATE_FIELDS);
    supportsSearch = true;

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put("dashboards", this::fetchAndSetDashboards);
    fieldFetchers.put("service", this::fetchAndSetServices);
  }

  @Override
  public void setFullyQualifiedName(Chart chart) {
    chart.setFullyQualifiedName(
        FullyQualifiedName.add(chart.getService().getFullyQualifiedName(), chart.getName()));
  }

  @Override
  public void prepare(Chart chart, boolean update) {
    DashboardService dashboardService = Entity.getEntity(chart.getService(), "", Include.ALL);
    chart.setService(dashboardService.getEntityReference());
    chart.setServiceType(dashboardService.getServiceType());
    chart.setDashboards(EntityUtil.getEntityReferences(chart.getDashboards(), Include.NON_DELETED));
  }

  @Override
  public void storeEntity(Chart chart, boolean update) {
    // Relationships and fields such as tags are not stored as part of json
    EntityReference service = chart.getService();
    List<EntityReference> dashboards = chart.getDashboards();
    chart.withService(null).withDashboards(null);
    store(chart, update);
    chart.withService(service).withDashboards(dashboards);
  }

  @Override
  @SneakyThrows
  public void storeRelationships(Chart chart) {
    addServiceRelationship(chart, chart.getService());
    // Add relationship from dashboard to chart
    for (EntityReference dashboard : listOrEmpty(chart.getDashboards())) {
      addRelationship(
          dashboard.getId(), chart.getId(), Entity.DASHBOARD, Entity.CHART, Relationship.HAS);
    }
  }

  @Override
  public void setFields(Chart chart, Fields fields) {
    chart.withService(getContainer(chart.getId()));
    chart.setDashboards(
        fields.contains("dashboards") ? getRelatedEntities(chart, Entity.DASHBOARD) : null);
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Chart> entities) {
    fetchAndSetDefaultService(entities);
    fetchAndSetFields(entities, fields);
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
    setFieldFromMap(true, charts, batchFetchDashboards(charts), Chart::setDashboards);
  }

  private void fetchAndSetServices(List<Chart> charts, Fields fields) {
    if (!fields.contains("service") || charts == null || charts.isEmpty()) {
      return;
    }
    // For charts, all should have the same service (dashboard service)
    EntityReference service = getContainer(charts.get(0).getId());
    for (Chart chart : charts) {
      chart.setService(service);
    }
  }

  @Override
  public void clearFields(Chart chart, Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void restorePatchAttributes(Chart original, Chart updated) {
    // Patch can't make changes to following fields. Ignore the changes
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  public EntityRepository<Chart>.EntityUpdater getUpdater(
      Chart original, Chart updated, Operation operation, ChangeSource changeSource) {
    return new ChartUpdater(original, updated, operation);
  }

  @Override
  public EntityInterface getParentEntity(Chart entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  private List<EntityReference> getRelatedEntities(Chart chart, String entityType) {
    return chart == null
        ? Collections.emptyList()
        : findFrom(chart.getId(), Entity.CHART, Relationship.HAS, entityType);
  }

  public class ChartUpdater extends ColumnEntityUpdater {
    public ChartUpdater(Chart chart, Chart updated, Operation operation) {
      super(chart, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("chartType", original.getChartType(), updated.getChartType());
      recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl());
      recordChange("sourceHash", original.getSourceHash(), updated.getSourceHash());
      update(
          Entity.DASHBOARD,
          "dashboards",
          listOrEmpty(updated.getDashboards()),
          listOrEmpty(original.getDashboards()));
    }

    private void update(
        String entityType,
        String field,
        List<EntityReference> updEntities,
        List<EntityReference> oriEntities) {

      // Remove all entity type associated with this dashboard
      deleteTo(updated.getId(), Entity.CHART, Relationship.HAS, entityType);

      // Add relationship from dashboard to chart type
      for (EntityReference entity : updEntities) {
        addRelationship(
            entity.getId(), updated.getId(), entityType, Entity.CHART, Relationship.HAS);
      }

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange(
          field, oriEntities, updEntities, added, deleted, EntityUtil.entityReferenceMatch);
    }
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
        daoCollection
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
        daoCollection
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
}
