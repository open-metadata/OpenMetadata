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
import static org.openmetadata.service.Entity.FIELD_TAGS;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.Collections;
import java.util.List;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.databases.DatabaseUtil;
import org.openmetadata.service.resources.datamodels.DashboardDataModelResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class DashboardDataModelRepository extends EntityRepository<DashboardDataModel> {

  private static final String DATA_MODELS_FIELD = "dataModels";

  private static final String DATA_MODEL_UPDATE_FIELDS = "owner,tags,followers";
  private static final String DATA_MODEL_PATCH_FIELDS = "owner,tags,followers";

  public DashboardDataModelRepository(CollectionDAO dao) {
    super(
        DashboardDataModelResource.COLLECTION_PATH,
        Entity.DASHBOARD_DATA_MODEL,
        DashboardDataModel.class,
        dao.dataModelDAO(),
        dao,
        DATA_MODEL_PATCH_FIELDS,
        DATA_MODEL_UPDATE_FIELDS);
  }

  @Override
  public void setFullyQualifiedName(DashboardDataModel dashboardDataModel) {
    dashboardDataModel.setFullyQualifiedName(
        FullyQualifiedName.add(dashboardDataModel.getService().getName() + ".model", dashboardDataModel.getName()));
    ColumnUtil.setColumnFQN(dashboardDataModel.getFullyQualifiedName(), dashboardDataModel.getColumns());
  }

  @Override
  public String getFullyQualifiedNameHash(DashboardDataModel dashboardDataModel) {
    return FullyQualifiedName.buildHash(dashboardDataModel.getFullyQualifiedName());
  }

  @Override
  public void prepare(DashboardDataModel dashboardDataModel) throws IOException {
    DashboardService dashboardService = Entity.getEntity(dashboardDataModel.getService(), "", Include.ALL);
    dashboardDataModel.setService(dashboardService.getEntityReference());
    dashboardDataModel.setServiceType(dashboardService.getServiceType());
  }

  @Override
  public void storeEntity(DashboardDataModel dashboardDataModel, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = dashboardDataModel.getOwner();
    List<TagLabel> tags = dashboardDataModel.getTags();
    List<EntityReference> dataModels = dashboardDataModel.getDataModels();
    EntityReference service = dashboardDataModel.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    dashboardDataModel.withOwner(null).withService(null).withHref(null).withTags(null).withDataModels(null);

    store(dashboardDataModel, update);

    // Restore the relationships
    dashboardDataModel.withOwner(owner).withService(service).withTags(tags).withDataModels(dataModels);
  }

  @Override
  @SneakyThrows
  public void storeRelationships(DashboardDataModel dashboardDataModel) {
    EntityReference service = dashboardDataModel.getService();
    addRelationship(
        service.getId(),
        dashboardDataModel.getId(),
        service.getType(),
        Entity.DASHBOARD_DATA_MODEL,
        Relationship.CONTAINS);
    storeOwner(dashboardDataModel, dashboardDataModel.getOwner());
    applyTags(dashboardDataModel);
  }

  @Override
  public DashboardDataModel setFields(DashboardDataModel dashboardDataModel, Fields fields) throws IOException {
    getColumnTags(fields.contains(FIELD_TAGS), dashboardDataModel.getColumns());
    return dashboardDataModel
        .withService(getContainer(dashboardDataModel.getId()))
        .withFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(dashboardDataModel) : null)
        .withTags(fields.contains(FIELD_TAGS) ? getTags(dashboardDataModel.getFullyQualifiedName()) : null)
        .withDataModels(fields.contains(DATA_MODELS_FIELD) ? getDataModels(dashboardDataModel) : null);
  }

  @Override
  public void restorePatchAttributes(DashboardDataModel original, DashboardDataModel updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withService(original.getService())
        .withId(original.getId());
  }

  protected List<EntityReference> getDataModels(DashboardDataModel dashboardDataModel) throws IOException {
    if (dashboardDataModel == null) {
      return Collections.emptyList();
    }
    List<CollectionDAO.EntityRelationshipRecord> tableIds =
        findTo(dashboardDataModel.getId(), entityType, Relationship.USES, Entity.DASHBOARD_DATA_MODEL);
    return EntityUtil.populateEntityReferences(tableIds, Entity.TABLE);
  }

  private void getColumnTags(boolean setTags, List<Column> columns) {
    for (Column c : listOrEmpty(columns)) {
      c.setTags(setTags ? getTags(c.getFullyQualifiedName()) : null);
      getColumnTags(setTags, c.getChildren());
    }
  }

  private void applyTags(List<Column> columns) {
    // Add column level tags by adding tag to column relationship
    for (Column column : columns) {
      applyTags(column.getTags(), column.getFullyQualifiedName());
      if (column.getChildren() != null) {
        applyTags(column.getChildren());
      }
    }
  }

  @Override
  public void applyTags(DashboardDataModel dashboardDataModel) {
    // Add table level tags by adding tag to table relationship
    super.applyTags(dashboardDataModel);
    applyTags(dashboardDataModel.getColumns());
  }

  @Override
  public EntityUpdater getUpdater(DashboardDataModel original, DashboardDataModel updated, Operation operation) {
    return new DataModelUpdater(original, updated, operation);
  }

  public class DataModelUpdater extends ColumnEntityUpdater {

    public DataModelUpdater(DashboardDataModel original, DashboardDataModel updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      DatabaseUtil.validateColumns(original.getColumns());
      updateColumns("columns", original.getColumns(), updated.getColumns(), EntityUtil.columnMatch);
    }
  }
}
