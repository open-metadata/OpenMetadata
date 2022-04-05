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
import static org.openmetadata.catalog.type.Include.ALL;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.DatabaseSchema;
import org.openmetadata.catalog.jdbi3.DatabaseRepository.DatabaseEntityInterface;
import org.openmetadata.catalog.resources.databases.DatabaseResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityNameUtil;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

public class DatabaseSchemaRepository extends EntityRepository<DatabaseSchema> {
  private static final String DATABASE_SCHEMA_UPDATE_FIELDS = "owner";
  private static final String DATABASE_SCHEMA_PATCH_FIELDS = DATABASE_SCHEMA_UPDATE_FIELDS;

  public DatabaseSchemaRepository(CollectionDAO dao) {
    super(
        DatabaseResource.COLLECTION_PATH,
        Entity.DATABASE_SCHEMA,
        DatabaseSchema.class,
        dao.databaseSchemaDAO(),
        dao,
        DATABASE_SCHEMA_PATCH_FIELDS,
        DATABASE_SCHEMA_UPDATE_FIELDS);
  }

  public static String getFQN(DatabaseSchema schema) {
    return (schema != null) ? EntityNameUtil.getFQN(schema.getDatabase().getName(), schema.getName()) : null;
  }

  @Override
  public void prepare(DatabaseSchema schema) throws IOException {
    populateDatabase(schema);
    schema.setFullyQualifiedName(getFQN(schema));
    populateOwner(schema.getOwner()); // Validate owner
  }

  @Override
  public void storeEntity(DatabaseSchema schema, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = schema.getOwner();
    EntityReference service = schema.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    schema.withOwner(null).withService(null).withHref(null);

    if (update) {
      daoCollection.databaseSchemaDAO().update(schema.getId(), JsonUtils.pojoToJson(schema));
    } else {
      daoCollection.databaseSchemaDAO().insert(schema);
    }

    // Restore the relationships
    schema.withOwner(owner).withService(service);
  }

  @Override
  public void storeRelationships(DatabaseSchema schema) {
    EntityReference database = schema.getDatabase();
    addRelationship(
        database.getId(), schema.getId(), database.getType(), Entity.DATABASE_SCHEMA, Relationship.CONTAINS);
    storeOwner(schema, schema.getOwner());
  }

  private List<EntityReference> getTables(DatabaseSchema schema) throws IOException {
    if (schema == null) {
      return null;
    }
    List<String> tableIds = findTo(schema.getId(), Entity.DATABASE, Relationship.CONTAINS, Entity.TABLE);
    return EntityUtil.populateEntityReferences(tableIds, Entity.TABLE);
  }

  public DatabaseSchema setFields(DatabaseSchema schema, Fields fields) throws IOException {
    setDefaultFields(schema);
    schema.setOwner(fields.contains(FIELD_OWNER) ? getOwner(schema) : null);
    schema.setTables(fields.contains("tables") ? getTables(schema) : null);
    schema.setUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), schema.getId()) : null);
    return schema;
  }

  private void setDefaultFields(DatabaseSchema schema) throws IOException {
    EntityReference databaseRef = getContainer(schema.getId(), Entity.DATABASE_SCHEMA);
    Database database = Entity.getEntity(databaseRef, Fields.EMPTY_FIELDS, Include.ALL);
    schema.withDatabase(databaseRef).withService(database.getService());
  }

  @Override
  public void restorePatchAttributes(DatabaseSchema original, DatabaseSchema updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withService(original.getService())
        .withId(original.getId());
  }

  @Override
  public EntityInterface<DatabaseSchema> getEntityInterface(DatabaseSchema entity) {
    return new DatabaseSchemaEntityInterface(entity);
  }

  private void populateDatabase(DatabaseSchema schema) throws IOException {
    Database database = Entity.getEntity(schema.getDatabase(), Fields.EMPTY_FIELDS, ALL);
    schema.setDatabase(new DatabaseEntityInterface(database).getEntityReference());
    schema.setService(database.getService());
    schema.setServiceType(database.getServiceType());
  }

  public static class DatabaseSchemaEntityInterface extends EntityInterface<DatabaseSchema> {
    public DatabaseSchemaEntityInterface(DatabaseSchema entity) {
      super(Entity.DATABASE_SCHEMA, entity);
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
          : DatabaseSchemaRepository.getFQN(entity);
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
    public DatabaseSchema getEntity() {
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
    public DatabaseSchema withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }
  }
}
