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
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceEntityInterface;
import org.openmetadata.catalog.resources.dashboards.DashboardResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;

public class DashboardRepository extends EntityRepository<Dashboard> {
  private static final String DASHBOARD_UPDATE_FIELDS = "owner,tags,charts";
  private static final String DASHBOARD_PATCH_FIELDS = "owner,tags,charts";

  public DashboardRepository(CollectionDAO dao) {
    super(
        DashboardResource.COLLECTION_PATH,
        Entity.DASHBOARD,
        Dashboard.class,
        dao.dashboardDAO(),
        dao,
        DASHBOARD_PATCH_FIELDS,
        DASHBOARD_UPDATE_FIELDS);
  }

  public static String getFQN(Dashboard dashboard) {
    return (dashboard != null && dashboard.getService() != null)
        ? FullyQualifiedName.add(dashboard.getService().getName(), dashboard.getName())
        : null;
  }

  @Override
  public EntityInterface<Dashboard> getEntityInterface(Dashboard entity) {
    return new DashboardEntityInterface(entity);
  }

  @Override
  public Dashboard setFields(Dashboard dashboard, Fields fields) throws IOException {
    dashboard.setDisplayName(dashboard.getDisplayName());
    dashboard.setService(getService(dashboard));
    dashboard.setOwner(fields.contains(FIELD_OWNER) ? getOwner(dashboard) : null);
    dashboard.setFollowers(fields.contains("followers") ? getFollowers(dashboard) : null);
    dashboard.setCharts(fields.contains("charts") ? getCharts(dashboard) : null);
    dashboard.setTags(fields.contains("tags") ? getTags(dashboard.getFullyQualifiedName()) : null);
    dashboard.setUsageSummary(
        fields.contains("usageSummary")
            ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), dashboard.getId())
            : null);
    return dashboard;
  }

  @Override
  public void restorePatchAttributes(Dashboard original, Dashboard updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withId(original.getId())
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withService(original.getService())
        .withId(original.getId());
  }

  private EntityReference getService(Dashboard dashboard) throws IOException {
    return getContainer(dashboard.getId(), Entity.DASHBOARD);
  }

  private void populateService(Dashboard dashboard) throws IOException {
    DashboardService service = getService(dashboard.getService().getId(), dashboard.getService().getType());
    dashboard.setService(new DashboardServiceEntityInterface(service).getEntityReference());
    dashboard.setServiceType(service.getServiceType());
  }

  private DashboardService getService(UUID serviceId, String entityType) throws IOException {
    if (entityType.equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      return daoCollection.dashboardServiceDAO().findEntityById(serviceId);
    }
    throw new IllegalArgumentException(
        CatalogExceptionMessage.invalidServiceEntity(entityType, Entity.DASHBOARD, Entity.DASHBOARD_SERVICE));
  }

  public void setService(Dashboard dashboard, EntityReference service) {
    if (service != null && dashboard != null) {
      // TODO remove this
      addRelationship(service.getId(), dashboard.getId(), service.getType(), Entity.DASHBOARD, Relationship.CONTAINS);
      dashboard.setService(service);
    }
  }

  @Override
  public void prepare(Dashboard dashboard) throws IOException {
    populateService(dashboard);
    dashboard.setFullyQualifiedName(getFQN(dashboard));
    populateOwner(dashboard.getOwner()); // Validate owner
    dashboard.setTags(addDerivedTags(dashboard.getTags()));
    dashboard.setCharts(getCharts(dashboard.getCharts()));
  }

  @Override
  public void storeEntity(Dashboard dashboard, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = dashboard.getOwner();
    List<TagLabel> tags = dashboard.getTags();
    EntityReference service = dashboard.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    dashboard.withOwner(null).withHref(null).withTags(null).withService(null);

    store(dashboard.getId(), dashboard, update);

    // Restore the relationships
    dashboard.withOwner(owner).withTags(tags).withService(service);
  }

  @Override
  public void storeRelationships(Dashboard dashboard) {
    setService(dashboard, dashboard.getService());

    // Add relationship from dashboard to chart
    if (dashboard.getCharts() != null) {
      for (EntityReference chart : dashboard.getCharts()) {
        addRelationship(dashboard.getId(), chart.getId(), Entity.DASHBOARD, Entity.CHART, Relationship.HAS);
      }
    }
    // Add owner relationship
    storeOwner(dashboard, dashboard.getOwner());

    // Add tag to dashboard relationship
    applyTags(dashboard);
  }

  @Override
  public EntityUpdater getUpdater(Dashboard original, Dashboard updated, Operation operation) {
    return new DashboardUpdater(original, updated, operation);
  }

  private List<EntityReference> getCharts(Dashboard dashboard) throws IOException {
    if (dashboard == null) {
      return null;
    }
    List<String> chartIds = findTo(dashboard.getId(), Entity.DASHBOARD, Relationship.HAS, Entity.CHART);
    return EntityUtil.populateEntityReferences(chartIds, Entity.CHART);
  }

  /**
   * This method is used to populate the dashboard entity with all details of Chart EntityReference Users/Tools can send
   * minimum details required to set relationship as id, type are the only required fields in entity reference, whereas
   * we need to send fully populated object such that ElasticSearch index has all the details.
   */
  private List<EntityReference> getCharts(List<EntityReference> charts) throws IOException {
    if (charts == null) {
      return null;
    }
    List<EntityReference> chartRefs = new ArrayList<>();
    for (EntityReference chart : charts) {
      EntityReference chartRef = daoCollection.chartDAO().findEntityReferenceById(chart.getId());
      chartRefs.add(chartRef);
    }
    return chartRefs.isEmpty() ? null : chartRefs;
  }

  public void updateCharts(Dashboard original, Dashboard updated, EntityUpdater updater)
      throws JsonProcessingException {
    // Remove all charts associated with this dashboard
    deleteFrom(updated.getId(), Entity.DASHBOARD, Relationship.HAS, Entity.CHART);

    // Add relationship from dashboard to chart
    if (updated.getCharts() != null) {
      for (EntityReference chart : updated.getCharts()) {
        addRelationship(updated.getId(), chart.getId(), Entity.DASHBOARD, Entity.CHART, Relationship.HAS);
      }
    }
    List<UUID> origChartIds = EntityUtil.getIDList(original.getCharts());
    List<UUID> updatedChartIds = EntityUtil.getIDList(updated.getCharts());
    updater.recordChange("charts", origChartIds, updatedChartIds);
  }

  public static class DashboardEntityInterface extends EntityInterface<Dashboard> {
    public DashboardEntityInterface(Dashboard entity) {
      super(Entity.DASHBOARD, entity);
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
      return entity.getFullyQualifiedName() != null
          ? entity.getFullyQualifiedName()
          : DashboardRepository.getFQN(entity);
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
    public Dashboard getEntity() {
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
    public Dashboard withHref(URI href) {
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

  /** Handles entity updated from PUT and POST operation. */
  public class DashboardUpdater extends EntityUpdater {
    public DashboardUpdater(Dashboard original, Dashboard updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateCharts();
    }

    private void updateCharts() throws JsonProcessingException {
      // Remove all charts associated with this dashboard
      deleteFrom(updated.getId(), Entity.DASHBOARD, Relationship.HAS, Entity.CHART);

      // Add relationship from dashboard to chart
      List<EntityReference> updatedCharts = listOrEmpty(updated.getEntity().getCharts());
      List<EntityReference> origCharts = listOrEmpty(original.getEntity().getCharts());
      for (EntityReference chart : updatedCharts) {
        addRelationship(updated.getId(), chart.getId(), Entity.DASHBOARD, Entity.CHART, Relationship.HAS);
      }

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange("charts", origCharts, updatedCharts, added, deleted, EntityUtil.entityReferenceMatch);
    }
  }
}
