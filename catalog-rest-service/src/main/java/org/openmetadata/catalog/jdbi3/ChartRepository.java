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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.Entity.FIELD_TAGS;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.List;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.resources.charts.ChartResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;

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
    DashboardService dashboardService = Entity.getEntity(chart.getService(), Fields.EMPTY_FIELDS, Include.ALL);
    chart.setService(dashboardService.getEntityReference());
    chart.setServiceType(dashboardService.getServiceType());
    setFullyQualifiedName(chart);
    chart.setOwner(Entity.getEntityReference(chart.getOwner()));
    chart.setTags(addDerivedTags(chart.getTags()));
  }

  @Override
  public void storeEntity(Chart chart, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = chart.getOwner();
    List<TagLabel> tags = chart.getTags();
    EntityReference service = chart.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    chart.withOwner(null).withService(null).withHref(null).withTags(null);

    store(chart.getId(), chart, update);

    // Restore the relationships
    chart.withOwner(owner).withService(service).withTags(tags);
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
    chart.setOwner(fields.contains(FIELD_OWNER) ? getOwner(chart) : null);
    chart.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(chart) : null);
    chart.setTags(fields.contains(FIELD_TAGS) ? getTags(chart.getFullyQualifiedName()) : null);
    return chart;
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
}
