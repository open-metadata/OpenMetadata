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
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.dashboards.DashboardResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

public class DashboardRepository extends EntityRepository<Dashboard> {
  private static final String DASHBOARD_UPDATE_FIELDS = "owner,tags,charts,extension,followers,dataModels";
  private static final String DASHBOARD_PATCH_FIELDS = "owner,tags,charts,extension,followers,dataModels";

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
    dashboard.setFullyQualifiedName(
        FullyQualifiedName.add(dashboard.getService().getFullyQualifiedName(), dashboard.getName()));
  }

  @Override
  public Dashboard setFields(Dashboard dashboard, Fields fields) throws IOException {
    dashboard.setService(getContainer(dashboard.getId()));
    dashboard.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(dashboard) : null);
    dashboard.setCharts(fields.contains("charts") ? getRelatedEntities(dashboard, Entity.CHART) : null);
    dashboard.setDataModels(
        fields.contains("dataModels") ? getRelatedEntities(dashboard, Entity.DASHBOARD_DATA_MODEL) : null);
    return dashboard.withUsageSummary(
        fields.contains("usageSummary")
            ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), dashboard.getId())
            : null);
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
    DashboardService service = Entity.getEntity(dashboard.getService(), "", Include.NON_DELETED);
    dashboard.setService(service.getEntityReference());
    dashboard.setServiceType(service.getServiceType());
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
    dashboard.setCharts(EntityUtil.getEntityReferences(dashboard.getCharts(), Include.NON_DELETED));
    dashboard.setDataModels(EntityUtil.getEntityReferences(dashboard.getDataModels(), Include.NON_DELETED));
  }

  @Override
  public void storeEntity(Dashboard dashboard, boolean update) throws JsonProcessingException {
    // Relationships and fields such as service are not stored as part of json
    EntityReference service = dashboard.getService();
    List<EntityReference> charts = dashboard.getCharts();
    List<EntityReference> dataModels = dashboard.getDataModels();

    dashboard.withService(null).withCharts(null).withDataModels(null);
    store(dashboard, update);
    dashboard.withService(service).withCharts(charts).withDataModels(dataModels);
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

    // Add relationship from dashboard to data models
    if (dashboard.getDataModels() != null) {
      for (EntityReference dataModel : dashboard.getDataModels()) {
        addRelationship(
            dashboard.getId(), dataModel.getId(), Entity.DASHBOARD, Entity.DASHBOARD_DATA_MODEL, Relationship.HAS);
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

  private List<EntityReference> getRelatedEntities(Dashboard dashboard, String entityType) throws IOException {
    if (dashboard == null) {
      return Collections.emptyList();
    }
    List<EntityRelationshipRecord> ids = findTo(dashboard.getId(), Entity.DASHBOARD, Relationship.HAS, entityType);
    return EntityUtil.populateEntityReferences(ids, entityType);
  }

  /** Handles entity updated from PUT and POST operation. */
  public class DashboardUpdater extends EntityUpdater {
    public DashboardUpdater(Dashboard original, Dashboard updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      update(Entity.CHART, "charts", listOrEmpty(updated.getCharts()), listOrEmpty(original.getCharts()));
      update(
          Entity.DASHBOARD_DATA_MODEL,
          "dataModels",
          listOrEmpty(updated.getDataModels()),
          listOrEmpty(original.getDataModels()));
    }

    private void update(
        String entityType, String field, List<EntityReference> updEntities, List<EntityReference> oriEntities)
        throws JsonProcessingException {
      // Remove all entity type associated with this dashboard
      deleteFrom(updated.getId(), Entity.DASHBOARD, Relationship.HAS, entityType);

      // Add relationship from dashboard to entity type
      for (EntityReference entity : updEntities) {
        addRelationship(updated.getId(), entity.getId(), Entity.DASHBOARD, entityType, Relationship.HAS);
      }

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange(field, oriEntities, updEntities, added, deleted, EntityUtil.entityReferenceMatch);
    }
  }
}
