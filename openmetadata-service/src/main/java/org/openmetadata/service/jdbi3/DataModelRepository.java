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
import org.openmetadata.schema.entity.data.DataModel;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.databases.DatabaseUtil;
import org.openmetadata.service.resources.datamodels.DataModelResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class DataModelRepository extends EntityRepository<DataModel> {

  private static final String DATA_MODELS_FIELD = "dataModels";

  private static final String DATA_MODEL_UPDATE_FIELDS = "owner,tags,followers";
  private static final String DATA_MODEL_PATCH_FIELDS = "owner,tags,followers";

  public DataModelRepository(CollectionDAO dao) {
    super(
        DataModelResource.COLLECTION_PATH,
        Entity.DATA_MODEL,
        DataModel.class,
        dao.dataModelDAO(),
        dao,
        DATA_MODEL_PATCH_FIELDS,
        DATA_MODEL_UPDATE_FIELDS);
  }

  @Override
  public void setFullyQualifiedName(DataModel dataModel) {
    dataModel.setFullyQualifiedName(
        FullyQualifiedName.add(dataModel.getService().getName() + ".model", dataModel.getName()));
    ColumnUtil.setColumnFQN(dataModel.getFullyQualifiedName(), dataModel.getColumns());
  }

  @Override
  public void prepare(DataModel dataModel) throws IOException {
    DashboardService dashboardService = Entity.getEntity(dataModel.getService(), "", Include.ALL);
    dataModel.setService(dashboardService.getEntityReference());
    dataModel.setServiceType(dashboardService.getServiceType());
  }

  @Override
  public void storeEntity(DataModel dataModel, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = dataModel.getOwner();
    List<TagLabel> tags = dataModel.getTags();
    List<EntityReference> dataModels = dataModel.getDataModels();
    EntityReference service = dataModel.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    dataModel.withOwner(null).withService(null).withHref(null).withTags(null).withDataModels(null);

    store(dataModel, update);

    // Restore the relationships
    dataModel.withOwner(owner).withService(service).withTags(tags).withDataModels(dataModels);
  }

  @Override
  @SneakyThrows
  public void storeRelationships(DataModel dataModel) {
    EntityReference service = dataModel.getService();
    addRelationship(service.getId(), dataModel.getId(), service.getType(), Entity.DATA_MODEL, Relationship.CONTAINS);
    storeOwner(dataModel, dataModel.getOwner());
    applyTags(dataModel);
  }

  @Override
  public DataModel setFields(DataModel dataModel, Fields fields) throws IOException {
    getColumnTags(fields.contains(FIELD_TAGS), dataModel.getColumns());
    return dataModel
        .withService(getContainer(dataModel.getId()))
        .withFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(dataModel) : null)
        .withTags(fields.contains(FIELD_TAGS) ? getTags(dataModel.getFullyQualifiedName()) : null)
        .withDataModels(fields.contains(DATA_MODELS_FIELD) ? getDataModels(dataModel) : null);
  }

  @Override
  public void restorePatchAttributes(DataModel original, DataModel updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withService(original.getService())
        .withId(original.getId());
  }

  protected List<EntityReference> getDataModels(DataModel dataModel) throws IOException {
    if (dataModel == null) {
      return Collections.emptyList();
    }
    List<CollectionDAO.EntityRelationshipRecord> tableIds =
        findTo(dataModel.getId(), entityType, Relationship.USES, Entity.DATA_MODEL);
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
  public void applyTags(DataModel dataModel) {
    // Add table level tags by adding tag to table relationship
    super.applyTags(dataModel);
    applyTags(dataModel.getColumns());
  }

  @Override
  public EntityUpdater getUpdater(DataModel original, DataModel updated, Operation operation) {
    return new DataModelUpdater(original, updated, operation);
  }

  public class DataModelUpdater extends ColumnEntityUpdater {

    public DataModelUpdater(DataModel original, DataModel updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      DatabaseUtil.validateColumns(original.getColumns());
      updateColumns("columns", original.getColumns(), updated.getColumns(), EntityUtil.columnMatch);
    }
  }
}
