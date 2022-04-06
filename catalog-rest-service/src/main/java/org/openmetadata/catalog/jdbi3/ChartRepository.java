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

import static org.openmetadata.catalog.Entity.FIELD_OWNER;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceEntityInterface;
import org.openmetadata.catalog.resources.charts.ChartResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
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

  public static String getFQN(Chart chart) {
    return (chart != null && chart.getService() != null)
        ? FullyQualifiedName.add(chart.getService().getName(), chart.getName())
        : null;
  }

  @Override
  public void prepare(Chart chart) throws IOException {
    DashboardService dashboardService = Entity.getEntity(chart.getService(), Fields.EMPTY_FIELDS, Include.ALL);
    chart.setService(new DashboardServiceEntityInterface(dashboardService).getEntityReference());
    chart.setServiceType(dashboardService.getServiceType());
    chart.setFullyQualifiedName(getFQN(chart));
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
    chart.setService(getService(chart));
    chart.setOwner(fields.contains(FIELD_OWNER) ? getOwner(chart) : null);
    chart.setFollowers(fields.contains("followers") ? getFollowers(chart) : null);
    chart.setTags(fields.contains("tags") ? getTags(chart.getFullyQualifiedName()) : null);
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

  @Override
  public EntityInterface<Chart> getEntityInterface(Chart entity) {
    return new ChartEntityInterface(entity);
  }

  private EntityReference getService(Chart chart) throws IOException {
    return getContainer(chart.getId(), Entity.CHART);
  }

  public static class ChartEntityInterface extends EntityInterface<Chart> {
    public ChartEntityInterface(Chart entity) {
      super(Entity.CHART, entity);
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public String getName() {
      return entity.getName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName() != null ? entity.getFullyQualifiedName() : ChartRepository.getFQN(entity);
    }

    @Override
    public List<TagLabel> getTags() {
      return entity.getTags();
    }

    @Override
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public List<EntityReference> getFollowers() {
      return entity.getFollowers();
    }

    @Override
    public Chart getEntity() {
      return entity;
    }

    @Override
    public EntityReference getContainer() {
      return entity.getService();
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setName(String name) {
      entity.setName(name);
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) {
      entity.setOwner(owner);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public Chart withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }
}
