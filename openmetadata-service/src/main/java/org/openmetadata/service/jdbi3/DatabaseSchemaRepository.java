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
import static org.openmetadata.service.Entity.FIELD_DOMAIN;
import static org.openmetadata.service.Entity.FIELD_OWNER;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.databases.DatabaseSchemaResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

public class DatabaseSchemaRepository extends EntityRepository<DatabaseSchema> {
  public DatabaseSchemaRepository(CollectionDAO dao) {
    super(
        DatabaseSchemaResource.COLLECTION_PATH,
        Entity.DATABASE_SCHEMA,
        DatabaseSchema.class,
        dao.databaseSchemaDAO(),
        dao,
        "",
        "");
  }

  @Override
  public void setFullyQualifiedName(DatabaseSchema schema) {
    schema.setFullyQualifiedName(
        FullyQualifiedName.add(schema.getDatabase().getFullyQualifiedName(), schema.getName()));
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
  }

  private List<EntityReference> getTables(DatabaseSchema schema) throws IOException {
    if (schema == null) {
      return Collections.emptyList();
    }
    return findTo(schema.getId(), Entity.DATABASE_SCHEMA, Relationship.CONTAINS, Entity.TABLE);
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
  public DatabaseSchema setInheritedFields(DatabaseSchema schema, Fields fields) throws IOException {
    Database database = null;
    UUID databaseId = schema.getDatabase().getId();
    // If schema does not have owner, then inherit parent database owner
    if (fields.contains(FIELD_OWNER) && schema.getOwner() == null) {
      database = Entity.getEntity(Entity.DATABASE, databaseId, "owner,domain", ALL);
      schema.withOwner(database.getOwner());
    }

    // If schema does not have domain, then inherit it from parent database
    if (fields.contains(FIELD_DOMAIN) && schema.getDomain() == null) {
      if (database == null) {
        database = Entity.getEntity(Entity.DATABASE, databaseId, "domain", ALL);
      }
      schema.withDomain(database.getDomain());
    }

    // If schema does not have its own retention period, then inherit parent database retention period
    if (schema.getRetentionPeriod() == null) {
      database = database == null ? Entity.getEntity(Entity.DATABASE, databaseId, "", ALL) : database;
      schema.withRetentionPeriod(database.getRetentionPeriod());
    }
    return schema;
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
  public EntityRepository<DatabaseSchema>.EntityUpdater getUpdater(
      DatabaseSchema original, DatabaseSchema updated, Operation operation) {
    return new DatabaseSchemaUpdater(original, updated, operation);
  }

  private void populateDatabase(DatabaseSchema schema) throws IOException {
    Database database = Entity.getEntity(schema.getDatabase(), "", ALL);
    schema
        .withDatabase(database.getEntityReference())
        .withService(database.getService())
        .withServiceType(database.getServiceType());
  }

  public class DatabaseSchemaUpdater extends EntityUpdater {
    public DatabaseSchemaUpdater(DatabaseSchema original, DatabaseSchema updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("retentionPeriod", original.getRetentionPeriod(), updated.getRetentionPeriod());
    }
  }
}
