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

import static org.openmetadata.service.Entity.LOCATION;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.databases.DatabaseResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

public class DatabaseRepository extends EntityRepository<Database> {
  private static final String DATABASE_UPDATE_FIELDS = "owner,tags";
  private static final String DATABASE_PATCH_FIELDS = DATABASE_UPDATE_FIELDS;

  public DatabaseRepository(CollectionDAO dao) {
    super(
        DatabaseResource.COLLECTION_PATH,
        Entity.DATABASE,
        Database.class,
        dao.databaseDAO(),
        dao,
        DATABASE_PATCH_FIELDS,
        DATABASE_UPDATE_FIELDS);
  }

  @Override
  public void setFullyQualifiedName(Database database) {
    database.setFullyQualifiedName(FullyQualifiedName.build(database.getService().getName(), database.getName()));
  }

  @Override
  public String getFullyQualifiedNameHash(Database entity) {
    return FullyQualifiedName.buildHash(entity.getFullyQualifiedName());
  }

  @Transaction
  public void deleteLocation(UUID databaseId) {
    deleteFrom(databaseId, Entity.DATABASE, Relationship.HAS, Entity.LOCATION);
  }

  @Override
  public void prepare(Database database) throws IOException {
    populateService(database);
  }

  @Override
  public void storeEntity(Database database, boolean update) throws IOException {
    // Relationships and fields such as service are not stored as part of json
    EntityReference service = database.getService();
    database.withService(null);
    store(database, update);
    database.withService(service);
  }

  @Override
  public void storeRelationships(Database database) {
    EntityReference service = database.getService();
    addRelationship(service.getId(), database.getId(), service.getType(), Entity.DATABASE, Relationship.CONTAINS);
    storeOwner(database, database.getOwner());
    // Add tag to database relationship
    applyTags(database);
  }

  private List<EntityReference> getSchemas(Database database) throws IOException {
    if (database == null) {
      return null;
    }
    List<EntityRelationshipRecord> schemaIds =
        findTo(database.getId(), Entity.DATABASE, Relationship.CONTAINS, Entity.DATABASE_SCHEMA);
    return EntityUtil.populateEntityReferences(schemaIds, Entity.DATABASE_SCHEMA);
  }

  public Database setFields(Database database, Fields fields) throws IOException {
    database.setService(getContainer(database.getId()));
    database.setDatabaseSchemas(fields.contains("databaseSchemas") ? getSchemas(database) : null);
    database.setUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), database.getId()) : null);
    return database.withLocation(fields.contains("location") ? getLocation(database) : null);
  }

  @Override
  public void restorePatchAttributes(Database original, Database updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withService(original.getService())
        .withId(original.getId());
  }

  private EntityReference getLocation(Database database) throws IOException {
    return database == null ? null : getToEntityRef(database.getId(), Relationship.HAS, LOCATION, false);
  }

  private void populateService(Database database) throws IOException {
    DatabaseService service = Entity.getEntity(database.getService(), "", Include.NON_DELETED);
    database.setService(service.getEntityReference());
    database.setServiceType(service.getServiceType());
  }
}
