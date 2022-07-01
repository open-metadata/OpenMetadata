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
import java.util.List;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.DatabaseSchema;
import org.openmetadata.catalog.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.catalog.resources.databases.DatabaseSchemaResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.JsonUtils;

public class DatabaseSchemaRepository extends EntityRepository<DatabaseSchema> {
  private static final String DATABASE_SCHEMA_UPDATE_FIELDS = "owner";
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
  public void prepare(DatabaseSchema schema) throws IOException {
    populateDatabase(schema);
    setFullyQualifiedName(schema);
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
    List<EntityRelationshipRecord> tableIds =
        findTo(schema.getId(), Entity.DATABASE_SCHEMA, Relationship.CONTAINS, Entity.TABLE);
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
    EntityReference databaseRef = getContainer(schema.getId());
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

  private void populateDatabase(DatabaseSchema schema) throws IOException {
    Database database = Entity.getEntity(schema.getDatabase(), Fields.EMPTY_FIELDS, ALL);
    schema.setDatabase(database.getEntityReference());
    schema.setService(database.getService());
    schema.setServiceType(database.getServiceType());
  }
}
