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
import java.util.List;
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
}
