/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
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
import org.openmetadata.catalog.entity.data.Model;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.models.ModelResource;
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

public class ModelRepository extends EntityRepository<Model> {
  static final Logger LOG = LoggerFactory.getLogger(ModelRepository.class);
  // Model fields that can be patched in a PATCH request
  static final Fields MODEL_PATCH_FIELDS = new Fields(ModelResource.FIELD_LIST,
           "owner,columns,database,tags");
    // Model fields that can be updated in a PUT request
  static final Fields MODEL_UPDATE_FIELDS = new Fields(ModelResource.FIELD_LIST,
           "owner,columns,database,tags");

  private final CollectionDAO dao;

  public ModelRepository(CollectionDAO dao) {
    super(ModelResource.COLLECTION_PATH, Model.class, dao.modelDAO(), dao, MODEL_PATCH_FIELDS, MODEL_UPDATE_FIELDS);
    this.dao = dao;
  }

  @Override
   public Model setFields(Model model, Fields fields) throws IOException, ParseException {
      model.setColumns(model.getColumns());
      model.setOwner(fields.contains("owner") ? getOwner(model) : null);
      model.setFollowers(fields.contains("followers") ? getFollowers(model) : null);
      model.setDatabase(fields.contains("database") ? getDatabase(model.getId()) : null);
      model.setTags(fields.contains("tags") ? getTags(model.getFullyQualifiedName()) : null);
      getColumnTags(fields.contains("tags"), model.getColumns());
      model.setViewDefinition(fields.contains("viewDefinition") ? model.getViewDefinition() : null);
      return model;
  }

  @Override
  public void restorePatchAttributes(Model original, Model updated) throws IOException, ParseException {
      // Patch can't make changes to following fields. Ignore the changes
      updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
              .withDatabase(original.getDatabase()).withId(original.getId());
  }

  @Override
  public EntityInterface<Model> getEntityInterface(Model entity) {
        return new ModelEntityInterface(entity);
    }

  public static String getFQN(Model model) {
        return (model.getDatabase().getName() + "." + model.getName());
    }

  @Transaction
  public void delete(UUID id) {
      dao.modelDAO().delete(id);
      dao.relationshipDAO().deleteAll(id.toString()); // Remove all relationships
  }

  @Transaction
  public EntityReference getOwnerReference(Model model) throws IOException {
      return EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), model.getOwner());
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
  public void validate(Model model) throws IOException {
      model.setDatabase(dao.databaseDAO().findEntityReferenceById(model.getDatabase().getId()));

      // Set data in table entity based on database relationship
      model.setFullyQualifiedName(getFQN(model));
      setColumnFQN(model.getFullyQualifiedName(), model.getColumns());

      // Check if owner is valid and set the relationship
      model.setOwner(EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), model.getOwner()));

      // Validate table tags and add derived tags to the list
      model.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), model.getTags()));

      // Validate column tags
      addDerivedTags(model.getColumns());
  }

  @Override
  public void store(Model model, boolean update) throws IOException {
      // Relationships and fields such as href are derived and not stored as part of json
      EntityReference owner = model.getOwner();
      EntityReference database = model.getDatabase();
      List<TagLabel> tags = model.getTags();

      // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
      model.withOwner(null).withDatabase(null).withHref(null).withTags(null);

      // Don't store column tags as JSON but build it on the fly based on relationships
      List<Column> columnWithTags = model.getColumns();
      model.setColumns(cloneWithoutTags(columnWithTags));
      model.getColumns().forEach(column -> column.setTags(null));

      if (update) {
          dao.modelDAO().update(model.getId(), JsonUtils.pojoToJson(model));
      } else {
          dao.modelDAO().insert(model);
      }

      // Restore the relationships
      model.withOwner(owner).withDatabase(database).withTags(tags);
      model.setColumns(columnWithTags);
  }

  @Override
  public void storeRelationships(Model model) throws IOException {
      // Add relationship from database to model
      String databaseId = model.getDatabase().getId().toString();
      dao.relationshipDAO().insert(databaseId, model.getId().toString(), Entity.DATABASE, Entity.MODEL,
              Relationship.CONTAINS.ordinal());

      // Add table owner relationship
      EntityUtil.setOwner(dao.relationshipDAO(), model.getId(), Entity.MODEL, model.getOwner());

      // Add tag to model relationship
      applyTags(model);
  }

  @Override
  public EntityUpdater getUpdater(Model original, Model updated, boolean patchOperation) throws IOException {
      return new ModelUpdater(original, updated, patchOperation);
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

  // TODO remove this
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

  private void applyTags(Model model) throws IOException {
      // Add table level tags by adding tag to model relationship
      EntityUtil.applyTags(dao.tagDAO(), model.getTags(), model.getFullyQualifiedName());
      model.setTags(getTags(model.getFullyQualifiedName())); // Update tag to handle additional derived tags
      applyTags(model.getColumns());
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

  private EntityReference getOwner(Model model) throws IOException {
      return model == null ? null : EntityUtil.populateOwner(model.getId(), dao.relationshipDAO(), dao.userDAO(),
              dao.teamDAO());
  }

  private List<EntityReference> getFollowers(Model model) throws IOException {
      return model == null ? null : EntityUtil.getFollowers(model.getId(), dao.relationshipDAO(), dao.userDAO());
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
  private void validateColumn(Model model, String columnName) {
      boolean validColumn = false;
      for (Column column : model.getColumns()) {
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
  private void validateColumnFQN(Model model, String columnFQN) {
      boolean validColumn = false;
      for (Column column : model.getColumns()) {
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
          String modelFQN = getModelFQN(joinedWith.getFullyQualifiedName());
          Model joinedWithModel = dao.modelDAO().findEntityByName(modelFQN);

          // Validate column
          validateColumnFQN(joinedWithModel, joinedWith.getFullyQualifiedName());
      }
  }

  private String getModelFQN(String columnFQN) {
      // Split columnFQN of format databaseServiceName.databaseName.model.columnName
      String[] split = columnFQN.split("\\.");
      if (split.length != 4) {
          throw new IllegalArgumentException("Invalid fully qualified column name " + columnFQN);
      }
      // Return model FQN of format databaseService.modelName
      return split[0] + "." + split[1] + "." + split[2];
  }


  public static class ModelEntityInterface implements EntityInterface<Model> {
      private final Model entity;

      public ModelEntityInterface(Model entity) {
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
                  .withDisplayName(getDisplayName()).withType(Entity.MODEL);
      }

      @Override
      public URI getHref() {
            return entity.getHref();
        }

      @Override
      public List<EntityReference> getFollowers() { return entity.getFollowers(); }

      @Override
      public Model getEntity() { return entity; }

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
      public Model withHref(URI href) { return entity.withHref(href); }

      @Override
      public void setTags(List<TagLabel> tags) {
            entity.setTags(tags);
        }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class ModelUpdater extends EntityUpdater {
      public ModelUpdater(Model original, Model updated, boolean patchOperation) {
          super(original, updated, patchOperation);
      }

      @Override
      public void entitySpecificUpdate() throws IOException {
          Model origModel = original.getEntity();
          Model updatedModel = updated.getEntity();
          updateNodeType(origModel, updatedModel);
          updateColumns("columns", origModel.getColumns(),
                  updated.getEntity().getColumns(), EntityUtil.columnMatch);
      }

      private void updateNodeType(Model origModel, Model updatedModel) throws JsonProcessingException {
          recordChange("nodeType", origModel.getNodeType(), updatedModel.getNodeType());
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
