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

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.charts.ChartResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class ChartRepository extends EntityRepository<Chart> {
  public ChartRepository() {
    super(
        ChartResource.COLLECTION_PATH,
        Entity.CHART,
        Chart.class,
        Entity.getCollectionDAO().chartDAO(),
        "",
        "");
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
  }

  @Override
  public void storeEntity(Chart chart, boolean update) {
    // Relationships and fields such as tags are not stored as part of json
    EntityReference service = chart.getService();
    chart.withService(null);
    store(chart, update);
    chart.withService(service);
  }

  @Override
  @SneakyThrows
  public void storeRelationships(Chart chart) {
    addServiceRelationship(chart, chart.getService());
  }

  @Override
  public void setFields(Chart chart, Fields fields) {
    chart.withService(getContainer(chart.getId()));
    chart.setSourceHash(fields.contains("sourceHash") ? chart.getSourceHash() : null);
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
  public EntityUpdater getUpdater(Chart original, Chart updated, Operation operation) {
    return new ChartUpdater(original, updated, operation);
  }

  @Override
  public EntityInterface getParentEntity(Chart entity, String fields) {
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  public class ChartUpdater extends ColumnEntityUpdater {
    public ChartUpdater(Chart chart, Chart updated, Operation operation) {
      super(chart, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate() {
      recordChange("chartType", original.getChartType(), updated.getChartType());
      recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl());
      recordChange("sourceHash", original.getSourceHash(), updated.getSourceHash());
    }
  }
}
