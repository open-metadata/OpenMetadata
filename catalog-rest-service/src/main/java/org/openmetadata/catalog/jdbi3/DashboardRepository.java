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

import static org.openmetadata.catalog.util.EntityUtil.toBoolean;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceEntityInterface;
import org.openmetadata.catalog.resources.dashboards.DashboardResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

public class DashboardRepository extends EntityRepository<Dashboard> {
  private static final Fields DASHBOARD_UPDATE_FIELDS = new Fields(DashboardResource.FIELD_LIST, "owner,tags,charts");
  private static final Fields DASHBOARD_PATCH_FIELDS = new Fields(DashboardResource.FIELD_LIST, "owner,tags,charts");

  public DashboardRepository(CollectionDAO dao) {
    super(
        DashboardResource.COLLECTION_PATH,
        Entity.DASHBOARD,
        Dashboard.class,
        dao.dashboardDAO(),
        dao,
        DASHBOARD_PATCH_FIELDS,
        DASHBOARD_UPDATE_FIELDS,
        true,
        true,
        true);
  }

  public static String getFQN(Dashboard dashboard) {
    return (dashboard.getService().getName() + "." + dashboard.getName());
  }

  @Override
  public EntityInterface<Dashboard> getEntityInterface(Dashboard entity) {
    return new DashboardEntityInterface(entity);
  }

  @Transaction
  public EntityReference getOwnerReference(Dashboard dashboard) throws IOException {
    return EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), dashboard.getOwner());
  }

  @Override
  public Dashboard setFields(Dashboard dashboard, Fields fields) throws IOException {
    dashboard.setDisplayName(dashboard.getDisplayName());
    dashboard.setService(getService(dashboard));
    dashboard.setOwner(fields.contains("owner") ? getOwner(dashboard) : null);
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
    EntityReference ref =
        EntityUtil.getService(
            daoCollection.relationshipDAO(),
            Entity.DASHBOARD,
            dashboard.getId(),
            Entity.DASHBOARD_SERVICE,
            toInclude(dashboard));
    if (ref != null) {
      DashboardService service = getService(ref.getId(), ref.getType());
      ref.setName(service.getName());
      ref.setDescription(service.getDescription());
    }
    return ref;
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
    throw new IllegalArgumentException(CatalogExceptionMessage.invalidServiceEntity(entityType, Entity.DASHBOARD));
  }

  public void setService(Dashboard dashboard, EntityReference service) {
    if (service != null && dashboard != null) {
      // TODO remove this
      daoCollection
          .relationshipDAO()
          .insert(
              service.getId().toString(),
              dashboard.getId().toString(),
              service.getType(),
              Entity.DASHBOARD,
              Relationship.CONTAINS.ordinal());
      dashboard.setService(service);
    }
  }

  @Override
  public void prepare(Dashboard dashboard) throws IOException {
    populateService(dashboard);
    dashboard.setFullyQualifiedName(getFQN(dashboard));
    EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), dashboard.getOwner()); // Validate owner
    dashboard.setTags(EntityUtil.addDerivedTags(daoCollection.tagDAO(), dashboard.getTags()));
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
    String dashboardId = dashboard.getId().toString();
    if (dashboard.getCharts() != null) {
      for (EntityReference chart : dashboard.getCharts()) {
        daoCollection
            .relationshipDAO()
            .insert(dashboardId, chart.getId().toString(), Entity.DASHBOARD, Entity.CHART, Relationship.HAS.ordinal());
      }
    }
    // Add owner relationship
    EntityUtil.setOwner(daoCollection.relationshipDAO(), dashboard.getId(), Entity.DASHBOARD, dashboard.getOwner());

    // Add tag to dashboard relationship
    applyTags(dashboard);
  }

  @Override
  public EntityUpdater getUpdater(Dashboard original, Dashboard updated, boolean patchOperation) {
    return new DashboardUpdater(original, updated, patchOperation);
  }

  private List<EntityReference> getCharts(Dashboard dashboard) throws IOException {
    if (dashboard == null) {
      return null;
    }
    String dashboardId = dashboard.getId().toString();
    List<String> chartIds =
        daoCollection
            .relationshipDAO()
            .findTo(
                dashboardId,
                Entity.DASHBOARD,
                Relationship.HAS.ordinal(),
                Entity.CHART,
                toBoolean(toInclude(dashboard)));
    List<EntityReference> charts = new ArrayList<>();
    for (String chartId : chartIds) {
      charts.add(daoCollection.chartDAO().findEntityReferenceById(UUID.fromString(chartId)));
    }
    return charts.isEmpty() ? null : charts;
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
    String dashboardId = updated.getId().toString();

    // Remove all charts associated with this dashboard
    daoCollection.relationshipDAO().deleteFrom(dashboardId, Entity.DASHBOARD, Relationship.HAS.ordinal(), Entity.CHART);

    // Add relationship from dashboard to chart
    if (updated.getCharts() != null) {
      for (EntityReference chart : updated.getCharts()) {
        daoCollection
            .relationshipDAO()
            .insert(dashboardId, chart.getId().toString(), Entity.DASHBOARD, Entity.CHART, Relationship.HAS.ordinal());
      }
    }
    List<UUID> origChartIds = EntityUtil.getIDList(original.getCharts());
    List<UUID> updatedChartIds = EntityUtil.getIDList(updated.getCharts());
    updater.recordChange("charts", origChartIds, updatedChartIds);
  }

  public static class DashboardEntityInterface implements EntityInterface<Dashboard> {
    private final Dashboard entity;

    public DashboardEntityInterface(Dashboard entity) {
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
    public Boolean isDeleted() {
      return entity.getDeleted();
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
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.DASHBOARD)
          .withHref(getHref());
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
    public DashboardUpdater(Dashboard original, Dashboard updated, boolean patchOperation) {
      super(original, updated, patchOperation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateCharts();
    }

    private void updateCharts() throws JsonProcessingException {
      String dashboardId = updated.getId().toString();

      // Remove all charts associated with this dashboard
      daoCollection
          .relationshipDAO()
          .deleteFrom(dashboardId, Entity.DASHBOARD, Relationship.HAS.ordinal(), Entity.CHART);

      // Add relationship from dashboard to chart
      List<EntityReference> updatedCharts =
          Optional.ofNullable(updated.getEntity().getCharts()).orElse(Collections.emptyList());
      List<EntityReference> origCharts =
          Optional.ofNullable(original.getEntity().getCharts()).orElse(Collections.emptyList());
      for (EntityReference chart : updatedCharts) {
        daoCollection
            .relationshipDAO()
            .insert(dashboardId, chart.getId().toString(), Entity.DASHBOARD, Entity.CHART, Relationship.HAS.ordinal());
      }

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange("charts", origCharts, updatedCharts, added, deleted, EntityUtil.entityReferenceMatch);
    }
  }
}
