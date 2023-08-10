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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.FIELD_DOMAIN;
import static org.openmetadata.service.Entity.FIELD_TAGS;

import java.util.List;
import javax.json.JsonPatch;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.databases.DatabaseUtil;
import org.openmetadata.service.resources.datamodels.DashboardDataModelResource;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class DashboardDataModelRepository extends EntityRepository<DashboardDataModel> {
  public DashboardDataModelRepository(CollectionDAO dao) {
    super(
        DashboardDataModelResource.COLLECTION_PATH,
        Entity.DASHBOARD_DATA_MODEL,
        DashboardDataModel.class,
        dao.dashboardDataModelDAO(),
        dao,
        "",
        "");
  }

  @Override
  public void setFullyQualifiedName(DashboardDataModel dashboardDataModel) {
    dashboardDataModel.setFullyQualifiedName(
        FullyQualifiedName.add(dashboardDataModel.getService().getName() + ".model", dashboardDataModel.getName()));
    ColumnUtil.setColumnFQN(dashboardDataModel.getFullyQualifiedName(), dashboardDataModel.getColumns());
  }

  @Override
  public void update(TaskDetails task, EntityLink entityLink, String newValue, String user) {
    if (entityLink.getFieldName().equals("columns")) {
      DashboardDataModel dashboardDataModel =
          getByName(null, entityLink.getEntityFQN(), getFields("columns,tags"), Include.ALL, false);
      String origJson = JsonUtils.pojoToJson(dashboardDataModel);
      Column column =
          dashboardDataModel.getColumns().stream()
              .filter(c -> c.getName().equals(entityLink.getArrayFieldName()))
              .findFirst()
              .orElseThrow(
                  () ->
                      new IllegalArgumentException(
                          CatalogExceptionMessage.invalidFieldName("column", entityLink.getArrayFieldName())));
      if (EntityUtil.isDescriptionTask(task.getType())) {
        column.setDescription(newValue);
      } else if (EntityUtil.isTagTask(task.getType())) {
        List<TagLabel> tags = JsonUtils.readObjects(newValue, TagLabel.class);
        column.setTags(tags);
      }
      String updatedEntityJson = JsonUtils.pojoToJson(dashboardDataModel);
      JsonPatch patch = JsonUtils.getJsonPatch(origJson, updatedEntityJson);
      patch(null, dashboardDataModel.getId(), user, patch);
      return;
    }
    super.update(task, entityLink, newValue, user);
  }

  @Override
  public void prepare(DashboardDataModel dashboardDataModel) {
    DashboardService dashboardService = Entity.getEntity(dashboardDataModel.getService(), "", Include.ALL);
    dashboardDataModel.setService(dashboardService.getEntityReference());
    dashboardDataModel.setServiceType(dashboardService.getServiceType());

    // Validate column tags
    validateColumnTags(dashboardDataModel.getColumns());
  }

  @Override
  public void storeEntity(DashboardDataModel dashboardDataModel, boolean update) {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference service = dashboardDataModel.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    dashboardDataModel.withService(null);

    store(dashboardDataModel, update);

    // Restore the relationships
    dashboardDataModel.withService(service);
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
  }

  @Override
  public DashboardDataModel setInheritedFields(DashboardDataModel dataModel, Fields fields) {
    if (fields.contains(FIELD_DOMAIN) && nullOrEmpty(dataModel.getDomain())) {
      DashboardService dashboardService = Entity.getEntity(dataModel.getService(), "domain", ALL);
      dataModel.setDomain(dashboardService.getDomain());
    }
    return dataModel;
  }

  @Override
  public DashboardDataModel setFields(DashboardDataModel dashboardDataModel, Fields fields) {
    getColumnTags(fields.contains(FIELD_TAGS), dashboardDataModel.getColumns());
    if (dashboardDataModel.getService() == null) {
      dashboardDataModel.withService(getContainer(dashboardDataModel.getId()));
    }
    return dashboardDataModel;
  }

  @Override
  public DashboardDataModel clearFields(DashboardDataModel dashboardDataModel, Fields fields) {
    return dashboardDataModel; // Nothing to do
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

  // TODO move this to base class?
  private void getColumnTags(boolean setTags, List<Column> columns) {
    for (Column c : listOrEmpty(columns)) {
      c.setTags(setTags ? getTags(c.getFullyQualifiedName()) : c.getTags());
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

  private void validateColumnTags(List<Column> columns) {
    for (Column column : columns) {
      checkMutuallyExclusive(column.getTags());
      if (column.getChildren() != null) {
        validateColumnTags(column.getChildren());
      }
    }
  }

  public class DataModelUpdater extends ColumnEntityUpdater {

    public DataModelUpdater(DashboardDataModel original, DashboardDataModel updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() {
      DatabaseUtil.validateColumns(original.getColumns());
      updateColumns("columns", original.getColumns(), updated.getColumns(), EntityUtil.columnMatch);
    }
  }
}
