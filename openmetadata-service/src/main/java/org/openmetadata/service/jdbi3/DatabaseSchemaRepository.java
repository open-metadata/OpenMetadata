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

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.FIELD_OWNER;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.databases.DatabaseSchemaResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

public class DatabaseSchemaRepository extends EntityRepository<DatabaseSchema> {
  private static final String DATABASE_SCHEMA_UPDATE_FIELDS = "owner,tags";
  private static final String DATABASE_SCHEMA_PATCH_FIELDS = DATABASE_SCHEMA_UPDATE_FIELDS;

  public DatabaseSchemaRepository(CollectionDAO dao) {
    super(
        DatabaseSchemaResource.COLLECTION_PATH,
        Entity.DATABASE_SCHEMA,
        DatabaseSchema.class,
        dao.databaseSchemaDAO(),
        dao,
        DATABASE_SCHEMA_PATCH_FIELDS,
        DATABASE_SCHEMA_UPDATE_FIELDS);
  }

  @Override
  public void setFullyQualifiedName(DatabaseSchema schema) {
    schema.setFullyQualifiedName(
        FullyQualifiedName.add(schema.getDatabase().getFullyQualifiedName(), schema.getName()));
  }

  @Override
  public String getFullyQualifiedNameHash(DatabaseSchema schema) {
    return FullyQualifiedName.buildHash(schema.getFullyQualifiedName());
  }

  @Override
  public void prepare(DatabaseSchema schema) throws IOException {
    populateDatabase(schema);
  }

  @Override
  public void storeEntity(DatabaseSchema schema, boolean update) throws IOException {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference service = schema.getService();
    schema.withService(null);

    store(schema, update);
    // Restore the relationships
    schema.withService(service);
  }

  @Override
  public void storeRelationships(DatabaseSchema schema) {
    EntityReference database = schema.getDatabase();
    addRelationship(
        database.getId(), schema.getId(), database.getType(), Entity.DATABASE_SCHEMA, Relationship.CONTAINS);
    storeOwner(schema, schema.getOwner());
    // Add tag to databaseSchema relationship
    applyTags(schema);
  }

  private List<EntityReference> getTables(DatabaseSchema schema) throws IOException {
    if (schema == null) {
      return Collections.emptyList();
    }
    List<EntityRelationshipRecord> tableIds =
        findTo(schema.getId(), Entity.DATABASE_SCHEMA, Relationship.CONTAINS, Entity.TABLE);
    return EntityUtil.populateEntityReferences(tableIds, Entity.TABLE);
  }

  public DatabaseSchema setFields(DatabaseSchema schema, Fields fields) throws IOException {
    setDefaultFields(schema);
    schema.setOwner(fields.contains(FIELD_OWNER) ? getOwner(schema) : null);
    schema.setTables(fields.contains("tables") ? getTables(schema) : null);
    return schema.withUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), schema.getId()) : null);
  }

  private void setDefaultFields(DatabaseSchema schema) throws IOException {
    EntityReference databaseRef = getContainer(schema.getId());
    Database database = Entity.getEntity(databaseRef, "", Include.ALL);
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

  private void populateDatabase(DatabaseSchema schema) throws IOException {
    Database database = Entity.getEntity(schema.getDatabase(), "owner", ALL);
    schema
        .withDatabase(database.getEntityReference())
        .withService(database.getService())
        .withServiceType(database.getServiceType());

    // Carry forward ownership from database, if necessary
    if (database.getOwner() != null && schema.getOwner() == null) {
      schema.withOwner(database.getOwner().withDescription("inherited"));
    }
  }
}
