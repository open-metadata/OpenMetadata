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

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceEntityInterface;
import org.openmetadata.catalog.resources.charts.ChartResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

public class ChartRepository extends EntityRepository<Chart> {
  private static final Fields CHART_UPDATE_FIELDS = new Fields(ChartResource.FIELD_LIST, "owner");
  private static final Fields CHART_PATCH_FIELDS = new Fields(ChartResource.FIELD_LIST, "owner,tags");
  private final CollectionDAO dao;

  public ChartRepository(CollectionDAO dao) {
    super(
        ChartResource.COLLECTION_PATH,
        Entity.CHART,
        Chart.class,
        dao.chartDAO(),
        dao,
        CHART_PATCH_FIELDS,
        CHART_UPDATE_FIELDS);
    this.dao = dao;
  }

  public static String getFQN(Chart chart) {
    return (chart.getService().getName() + "." + chart.getName());
  }

  @Override
  public void prepare(Chart chart) throws IOException {
    populateService(chart);
    chart.setFullyQualifiedName(getFQN(chart));
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), chart.getOwner()); // Validate and populate owner
    chart.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), chart.getTags()));
  }

  @Override
  public void storeEntity(Chart chart, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = chart.getOwner();
    List<TagLabel> tags = chart.getTags();
    EntityReference service = chart.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    chart.withOwner(null).withService(null).withHref(null).withTags(null);

    if (update) {
      dao.chartDAO().update(chart.getId(), JsonUtils.pojoToJson(chart));
    } else {
      dao.chartDAO().insert(chart);
    }

    // Restore the relationships
    chart.withOwner(owner).withService(service).withTags(tags);
  }

  @Override
  public void storeRelationships(Chart chart) {
    EntityReference service = chart.getService();
    dao.relationshipDAO()
        .insert(
            service.getId().toString(),
            chart.getId().toString(),
            service.getType(),
            Entity.CHART,
            Relationship.CONTAINS.ordinal());
    setOwner(chart, chart.getOwner());
    applyTags(chart);
  }

  private void applyTags(Chart chart) {
    // Add chart level tags by adding tag to chart relationship
    EntityUtil.applyTags(dao.tagDAO(), chart.getTags(), chart.getFullyQualifiedName());
    chart.setTags(getTags(chart.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  public EntityReference getOwner(Chart chart) throws IOException {
    return chart != null
        ? EntityUtil.populateOwner(chart.getId(), dao.relationshipDAO(), dao.userDAO(), dao.teamDAO())
        : null;
  }

  private void setOwner(Chart chart, EntityReference owner) {
    EntityUtil.setOwner(dao.relationshipDAO(), chart.getId(), Entity.CHART, owner);
    // TODO not required
    chart.setOwner(owner);
  }

  @Override
  public Chart setFields(Chart chart, Fields fields) throws IOException {
    chart.setService(getService(chart));
    chart.setOwner(fields.contains("owner") ? getOwner(chart) : null);
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

  private List<EntityReference> getFollowers(Chart chart) throws IOException {
    return chart == null ? null : EntityUtil.getFollowers(chart.getId(), dao.relationshipDAO(), dao.userDAO());
  }

  private List<TagLabel> getTags(String fqn) {
    return dao.tagDAO().getTags(fqn);
  }

  private EntityReference getService(Chart chart) throws IOException {
    EntityReference ref = EntityUtil.getService(dao.relationshipDAO(), chart.getId(), Entity.DASHBOARD_SERVICE);
    if (ref != null) {
      DashboardService service = getService(ref.getId(), ref.getType());
      ref.setName(service.getName());
      ref.setDescription(service.getDescription());
    }
    return ref;
  }

  private void populateService(Chart chart) throws IOException {
    DashboardService service = getService(chart.getService().getId(), chart.getService().getType());
    chart.setService(new DashboardServiceEntityInterface(service).getEntityReference());
    chart.setServiceType(service.getServiceType());
  }

  private DashboardService getService(UUID serviceId, String serviceType) throws IOException {
    if (serviceType.equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      return dao.dashboardServiceDAO().findEntityById(serviceId);
    }
    throw new IllegalArgumentException(
        CatalogExceptionMessage.invalidServiceEntity(serviceType, Entity.DASHBOARD_SERVICE));
  }

  public static class ChartEntityInterface implements EntityInterface<Chart> {
    private final Chart entity;

    public ChartEntityInterface(Chart entity) {
      this.entity = entity;
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
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName();
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
    public Date getUpdatedAt() {
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
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.CHART);
    }

    @Override
    public Chart getEntity() {
      return entity;
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
    public void setUpdateDetails(String updatedBy, Date updatedAt) {
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
