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
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.DbtModel;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.dbtmodels.DbtModelResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.JoinedWith;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiPredicate;

public class DbtModelRepository extends EntityRepository<DbtModel> {
  // Model fields that can be patched in a PATCH request
  static final Fields DBT_MODEL_PATCH_FIELDS = new Fields(DbtModelResource.FIELD_LIST,
           "owner,columns,database,tags,viewDefinition");
    // Model fields that can be updated in a PUT request
  static final Fields DBT_MODEL_UPDATE_FIELDS = new Fields(DbtModelResource.FIELD_LIST,
           "owner,columns,database,tags,viewDefinition");

  private final CollectionDAO dao;

  public DbtModelRepository(CollectionDAO dao) {
    super(DbtModelResource.COLLECTION_PATH, Entity.DBTMODEL, DbtModel.class, dao.dbtModelDAO(), dao,
        DBT_MODEL_PATCH_FIELDS, DBT_MODEL_UPDATE_FIELDS);
    this.dao = dao;
  }

  @Override
  public DbtModel setFields(DbtModel dbtModel, Fields fields) throws IOException, ParseException {
    dbtModel.setColumns(dbtModel.getColumns());
    dbtModel.setOwner(fields.contains("owner") ? getOwner(dbtModel) : null);
    dbtModel.setFollowers(fields.contains("followers") ? getFollowers(dbtModel) : null);
    dbtModel.setDatabase(fields.contains("database") ? getDatabase(dbtModel.getId()) : null);
    dbtModel.setTags(fields.contains("tags") ? getTags(dbtModel.getFullyQualifiedName()) : null);
    getColumnTags(fields.contains("tags"), dbtModel.getColumns());
    dbtModel.setViewDefinition(fields.contains("viewDefinition") ? dbtModel.getViewDefinition() : null);
    return dbtModel;
  }

  @Override
  public void restorePatchAttributes(DbtModel original, DbtModel updated) throws IOException, ParseException {
      // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
        .withDatabase(original.getDatabase()).withId(original.getId());
  }

  @Override
  public EntityInterface<DbtModel> getEntityInterface(DbtModel entity) {
    return new DbtModelEntityInterface(entity);
  }

  public static String getFQN(DbtModel dbtModel) {
    return (dbtModel.getDatabase().getName() + "." + dbtModel.getName());
  }

  @Transaction
  public void delete(UUID id) {
    dao.dbtModelDAO().delete(id);
    dao.relationshipDAO().deleteAll(id.toString()); // Remove all relationships
  }

  @Transaction
  public EntityReference getOwnerReference(DbtModel dbtModel) throws IOException {
    return EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), dbtModel.getOwner());
  }

  private void setColumnFQN(String parentFQN, List<Column> columns) {
    columns.forEach(c -> {
      String columnFqn = parentFQN + "." + c.getName();
      c.setFullyQualifiedName(columnFqn);
      if (c.getChildren() != null) {
        setColumnFQN(columnFqn, c.getChildren());
      }
    });
  }

  private void addDerivedTags(List<Column> columns) throws IOException {
    if (columns == null || columns.isEmpty()) {
      return;
    }

    for (Column column : columns) {
      column.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), column.getTags()));
      if (column.getChildren() != null) {
        addDerivedTags(column.getChildren());
      }
    }
  }

  @Override
  public void prepare(DbtModel dbtModel) throws IOException {
    dbtModel.setDatabase(dao.databaseDAO().findEntityReferenceById(dbtModel.getDatabase().getId()));

    // Set data in table entity based on database relationship
    dbtModel.setFullyQualifiedName(getFQN(dbtModel));
    setColumnFQN(dbtModel.getFullyQualifiedName(), dbtModel.getColumns());

    // Check if owner is valid and set the relationship
    dbtModel.setOwner(EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), dbtModel.getOwner()));

    // Validate table tags and add derived tags to the list
    dbtModel.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), dbtModel.getTags()));

    // Validate column tags
    addDerivedTags(dbtModel.getColumns());
  }

  @Override
  public void storeEntity(DbtModel dbtModel, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = dbtModel.getOwner();
    EntityReference database = dbtModel.getDatabase();
    List<TagLabel> tags = dbtModel.getTags();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    dbtModel.withOwner(null).withDatabase(null).withHref(null).withTags(null);

    // Don't store column tags as JSON but build it on the fly based on relationships
    List<Column> columnWithTags = dbtModel.getColumns();
    dbtModel.setColumns(cloneWithoutTags(columnWithTags));
    dbtModel.getColumns().forEach(column -> column.setTags(null));

    if (update) {
      dao.dbtModelDAO().update(dbtModel.getId(), JsonUtils.pojoToJson(dbtModel));
    } else {
      dao.dbtModelDAO().insert(dbtModel);
    }

    // Restore the relationships
    dbtModel.withOwner(owner).withDatabase(database).withTags(tags);
    dbtModel.setColumns(columnWithTags);
  }

  @Override
  public void storeRelationships(DbtModel dbtModel) throws IOException {
    // Add relationship from database to model
    String databaseId = dbtModel.getDatabase().getId().toString();
    dao.relationshipDAO().insert(databaseId, dbtModel.getId().toString(), Entity.DATABASE, Entity.DBTMODEL,
            Relationship.CONTAINS.ordinal());

    // Add table owner relationship
    EntityUtil.setOwner(dao.relationshipDAO(), dbtModel.getId(), Entity.DBTMODEL, dbtModel.getOwner());

    // Add tag to model relationship
    applyTags(dbtModel);
  }

  @Override
  public EntityUpdater getUpdater(DbtModel original, DbtModel updated, boolean patchOperation) throws IOException {
    return new DbtModelUpdater(original, updated, patchOperation);
  }

  List<Column> cloneWithoutTags(List<Column> columns) {
    if (columns == null || columns.isEmpty()) {
      return columns;
    }
    List<Column> copy = new ArrayList<>();
    columns.forEach(c -> copy.add(cloneWithoutTags(c)));
    return copy;
  }

  private Column cloneWithoutTags(Column column) {
    List<Column> children = cloneWithoutTags(column.getChildren());
    return new Column().withDescription(column.getDescription()).withName(column.getName())
      .withFullyQualifiedName(column.getFullyQualifiedName())
      .withArrayDataType(column.getArrayDataType())
      .withConstraint(column.getConstraint())
      .withDataTypeDisplay(column.getDataTypeDisplay())
      .withDataType(column.getDataType())
      .withDataLength(column.getDataLength())
      .withOrdinalPosition(column.getOrdinalPosition())
      .withChildren(children);
  }

  private void applyTags(List<Column> columns) throws IOException {
    // Add column level tags by adding tag to column relationship
    for (Column column : columns) {
      EntityUtil.applyTags(dao.tagDAO(), column.getTags(), column.getFullyQualifiedName());
      column.setTags(getTags(column.getFullyQualifiedName())); // Update tag list to handle derived tags
      if (column.getChildren() != null) {
        applyTags(column.getChildren());
      }
    }
  }

  private void applyTags(DbtModel dbtModel) throws IOException {
    // Add table level tags by adding tag to model relationship
    EntityUtil.applyTags(dao.tagDAO(), dbtModel.getTags(), dbtModel.getFullyQualifiedName());
    dbtModel.setTags(getTags(dbtModel.getFullyQualifiedName())); // Update tag to handle additional derived tags
    applyTags(dbtModel.getColumns());
  }

  private EntityReference getDatabase(UUID tableId) throws IOException {
    // Find database for the table
    List<String> result = dao.relationshipDAO().findFrom(tableId.toString(),
            Relationship.CONTAINS.ordinal(), Entity.DATABASE);
    if (result.size() != 1) {
      throw EntityNotFoundException.byMessage(String.format("Database for table %s Not found", tableId));
    }
    return dao.databaseDAO().findEntityReferenceById(UUID.fromString(result.get(0)));
  }

  private EntityReference getOwner(DbtModel dbtModel) throws IOException {
    return dbtModel == null ? null : EntityUtil.populateOwner(dbtModel.getId(), dao.relationshipDAO(), dao.userDAO(),
            dao.teamDAO());
  }

  private List<EntityReference> getFollowers(DbtModel dbtModel) throws IOException {
    return dbtModel == null ? null : EntityUtil.getFollowers(dbtModel.getId(), dao.relationshipDAO(), dao.userDAO());
  }

  private List<TagLabel> getTags(String fqn) {
    return dao.tagDAO().getTags(fqn);
  }

  private void getColumnTags(boolean setTags, List<Column> columns) {
    for (Column c : Optional.ofNullable(columns).orElse(Collections.emptyList())) {
      c.setTags(setTags ? getTags(c.getFullyQualifiedName()) : null);
      getColumnTags(setTags, c.getChildren());
    }
  }

  // Validate if a given column exists in the model
  private void validateColumn(DbtModel dbtModel, String columnName) {
    boolean validColumn = false;
    for (Column column : dbtModel.getColumns()) {
      if (column.getName().equals(columnName)) {
        validColumn = true;
        break;
      }
    }
    if (!validColumn) {
      throw new IllegalArgumentException("Invalid column name " + columnName);
    }
  }

  // Validate if a given column exists in the model
  private void validateColumnFQN(DbtModel dbtModel, String columnFQN) {
    boolean validColumn = false;
    for (Column column : dbtModel.getColumns()) {
      if (column.getFullyQualifiedName().equals(columnFQN)) {
        validColumn = true;
        break;
      }
    }
    if (!validColumn) {
      throw new IllegalArgumentException(CatalogExceptionMessage.invalidColumnFQN(columnFQN));
    }
  }

  private void validateColumnFQNs(List<JoinedWith> joinedWithList) throws IOException {
    for (JoinedWith joinedWith : joinedWithList) {
        // Validate model
      String modelFQN = getDbtModelFQN(joinedWith.getFullyQualifiedName());
      DbtModel joinedWithModel = dao.dbtModelDAO().findEntityByName(modelFQN);

      // Validate column
      validateColumnFQN(joinedWithModel, joinedWith.getFullyQualifiedName());
    }
  }

  private String getDbtModelFQN(String columnFQN) {
    // Split columnFQN of format databaseServiceName.databaseName.model.columnName
    String[] split = columnFQN.split("\\.");
    if (split.length != 4) {
      throw new IllegalArgumentException("Invalid fully qualified column name " + columnFQN);
    }
    // Return model FQN of format databaseService.modelName
    return split[0] + "." + split[1] + "." + split[2];
  }


  public static class DbtModelEntityInterface implements EntityInterface<DbtModel> {
    private final DbtModel entity;

    public DbtModelEntityInterface(DbtModel entity) {
      this.entity = entity;
    }

    @Override
    public UUID getId() { return entity.getId(); }

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
    public Double getVersion() { return entity.getVersion(); }

    @Override
    public String getUpdatedBy() { return entity.getUpdatedBy(); }

    @Override
    public Date getUpdatedAt() { return entity.getUpdatedAt(); }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
        .withDisplayName(getDisplayName()).withType(Entity.DBTMODEL);
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public List<EntityReference> getFollowers() { return entity.getFollowers(); }

    @Override
    public DbtModel getEntity() { return entity; }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public void setId(UUID id) { entity.setId(id); }

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
    public void setOwner(EntityReference owner) { entity.setOwner(owner); }

    @Override
    public DbtModel withHref(URI href) { return entity.withHref(href); }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class DbtModelUpdater extends EntityUpdater {
    public DbtModelUpdater(DbtModel original, DbtModel updated, boolean patchOperation) {
      super(original, updated, patchOperation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      DbtModel origDbtModel = original.getEntity();
      DbtModel updatedDbtModel = updated.getEntity();
      updateDBTNodeType(origDbtModel, updatedDbtModel);
      updateColumns("columns", origDbtModel.getColumns(),
            updated.getEntity().getColumns(), EntityUtil.columnMatch);
    }

    private void updateDBTNodeType(DbtModel origModel, DbtModel updatedModel) throws JsonProcessingException {
      recordChange("dbtNodeType", origModel.getDbtNodeType(), updatedModel.getDbtNodeType());
    }

    private void updateColumns(String fieldName, List<Column> origColumns, List<Column> updatedColumns,
                               BiPredicate<Column, Column> columnMatch) throws IOException {
      List<Column> deletedColumns = new ArrayList<>();
      List<Column> addedColumns = new ArrayList<>();
      recordListChange(fieldName, origColumns, updatedColumns, addedColumns, deletedColumns, columnMatch);

      // Delete tags related to deleted columns
      deletedColumns.forEach(deleted -> EntityUtil.removeTags(dao.tagDAO(), deleted.getFullyQualifiedName()));

      // Add tags related to deleted columns
      for (Column added : addedColumns) {
        EntityUtil.applyTags(dao.tagDAO(), added.getTags(), added.getFullyQualifiedName());
      }

      // Carry forward the user generated metadata from existing columns to new columns
      for (Column updated : updatedColumns) {
        // Find stored column matching name, data type and ordinal position
        Column stored = origColumns.stream().filter(c ->
          EntityUtil.columnMatch.test(c, updated)).findAny().orElse(null);
        if (stored == null) { // New column added
          continue;
        }

        updateColumnDescription(stored, updated);
        updateTags(stored.getFullyQualifiedName(), fieldName + "." + updated.getName() + ".tags",
                stored.getTags(), updated.getTags());
        updateColumnConstraint(stored, updated);

        if (updated.getChildren() != null && stored.getChildren() != null) {
          String childrenFieldName = fieldName + "." + updated.getName();
          updateColumns(childrenFieldName, stored.getChildren(), updated.getChildren(), columnMatch);
        }
      }

      if (!deletedColumns.isEmpty()) {
        majorVersionChange = true;
      }
    }

    private void updateColumnDescription(Column origColumn, Column updatedColumn) throws JsonProcessingException {
      if (!patchOperation
          && origColumn.getDescription() != null && !origColumn.getDescription().isEmpty()) {
        // Update description only when stored is empty to retain user authored descriptions
        updatedColumn.setDescription(origColumn.getDescription());
        return;
      }
      recordChange(getColumnField(origColumn, "description"),
          origColumn.getDescription(), updatedColumn.getDescription());
    }

    private void updateColumnConstraint(Column origColumn, Column updatedColumn) throws JsonProcessingException {
      recordChange(getColumnField(origColumn, "constraint"),
            origColumn.getConstraint(), updatedColumn.getConstraint());
    }

    private String getColumnField(Column column, String columnField) {
      // Remove model FQN from column FQN to get the local name
      String localColumnName = EntityUtil.getLocalColumnName(column.getFullyQualifiedName());
      return "columns." + localColumnName + (columnField == null ? "" : "." + columnField);
    }
  }
}
