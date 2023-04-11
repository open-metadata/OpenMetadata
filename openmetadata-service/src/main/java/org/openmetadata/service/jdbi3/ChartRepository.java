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

import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.charts.ChartResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class ChartRepository extends EntityRepository<Chart> {
  private static final String CHART_UPDATE_FIELDS = "owner";
  private static final String CHART_PATCH_FIELDS = "owner,tags";

  public ChartRepository(CollectionDAO dao) {
    super(
        ChartResource.COLLECTION_PATH,
        Entity.CHART,
        Chart.class,
        dao.chartDAO(),
        dao,
        CHART_PATCH_FIELDS,
        CHART_UPDATE_FIELDS);
  }

  @Override
  public void setFullyQualifiedName(Chart chart) {
    chart.setFullyQualifiedName(FullyQualifiedName.add(chart.getService().getName(), chart.getName()));
  }

  @Override
  public void prepare(Chart chart) throws IOException {
    DashboardService dashboardService = Entity.getEntity(chart.getService(), "", Include.ALL);
    chart.setService(dashboardService.getEntityReference());
    chart.setServiceType(dashboardService.getServiceType());
  }

  @Override
  public void storeEntity(Chart chart, boolean update) throws JsonProcessingException {
    // Relationships and fields such as tags are not stored as part of json
    EntityReference service = chart.getService();
    chart.withService(null);
    store(chart, update);
    chart.withService(service);
  }

  @Override
  @SneakyThrows
  public void storeRelationships(Chart chart) {
    EntityReference service = chart.getService();
    addRelationship(service.getId(), chart.getId(), service.getType(), Entity.CHART, Relationship.CONTAINS);
    storeOwner(chart, chart.getOwner());
    applyTags(chart);
  }

  @Override
  public Chart setFields(Chart chart, Fields fields) throws IOException {
    chart.setService(getContainer(chart.getId()));
    return chart.withFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(chart) : null);
  }

  @Override
  public void restorePatchAttributes(Chart original, Chart updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withService(original.getService())
        .withId(original.getId());
  }

  @Override
  public EntityUpdater getUpdater(Chart original, Chart updated, Operation operation) {
    return new ChartUpdater(original, updated, operation);
  }

  public class ChartUpdater extends ColumnEntityUpdater {
    public ChartUpdater(Chart chart, Chart updated, Operation operation) {
      super(chart, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("chartType", original.getChartType(), updated.getChartType());
      recordChange("chartUrl", original.getChartUrl(), updated.getChartUrl());
    }
  }
}
