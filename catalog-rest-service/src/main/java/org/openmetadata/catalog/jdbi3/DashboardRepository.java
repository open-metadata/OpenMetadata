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

import static org.openmetadata.catalog.Entity.FIELD_EXTENSION;
import static org.openmetadata.catalog.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.Entity.FIELD_TAGS;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.catalog.resources.dashboards.DashboardResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;

public class DashboardRepository extends EntityRepository<Dashboard> {
  private static final String DASHBOARD_UPDATE_FIELDS = "owner,tags,charts,extension";
  private static final String DASHBOARD_PATCH_FIELDS = "owner,tags,charts,extension";

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

  @Override
  public void setFullyQualifiedName(Dashboard dashboard) {
    dashboard.setFullyQualifiedName(FullyQualifiedName.add(dashboard.getService().getName(), dashboard.getName()));
  }

  @Override
  public Dashboard setFields(Dashboard dashboard, Fields fields) throws IOException {
    dashboard.setService(getContainer(dashboard.getId()));
    dashboard.setOwner(fields.contains(FIELD_OWNER) ? getOwner(dashboard) : null);
    dashboard.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(dashboard) : null);
    dashboard.setCharts(fields.contains("charts") ? getCharts(dashboard) : null);
    dashboard.setTags(fields.contains(FIELD_TAGS) ? getTags(dashboard.getFullyQualifiedName()) : null);
    dashboard.setUsageSummary(
        fields.contains("usageSummary")
            ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), dashboard.getId())
            : null);
    dashboard.setExtension(fields.contains(FIELD_EXTENSION) ? getExtension(dashboard) : null);
    return dashboard;
  }

  @Override
  public void restorePatchAttributes(Dashboard original, Dashboard updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withId(original.getId())
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withService(original.getService());
  }

  private void populateService(Dashboard dashboard) throws IOException {
    DashboardService service = getService(dashboard.getService().getId(), dashboard.getService().getType());
    dashboard.setService(service.getEntityReference());
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
    setFullyQualifiedName(dashboard);
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
    List<EntityRelationshipRecord> chartIds =
        findTo(dashboard.getId(), Entity.DASHBOARD, Relationship.HAS, Entity.CHART);
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
      List<EntityReference> updatedCharts = listOrEmpty(updated.getCharts());
      List<EntityReference> origCharts = listOrEmpty(original.getCharts());
      for (EntityReference chart : updatedCharts) {
        addRelationship(updated.getId(), chart.getId(), Entity.DASHBOARD, Entity.CHART, Relationship.HAS);
      }

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange("charts", origCharts, updatedCharts, added, deleted, EntityUtil.entityReferenceMatch);
    }
  }
}
