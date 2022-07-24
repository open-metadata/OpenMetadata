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

import static javax.ws.rs.core.Response.Status.CREATED;
import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.Entity.LOCATION;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.Response.Status;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.catalog.resources.databases.DatabaseResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;

public class DatabaseRepository extends EntityRepository<Database> {
  private static final String DATABASE_UPDATE_FIELDS = "owner";
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
    database.setFullyQualifiedName(FullyQualifiedName.add(database.getService().getName(), database.getName()));
  }

  @Transaction
  public void deleteLocation(String databaseId) {
    deleteFrom(UUID.fromString(databaseId), Entity.DATABASE, Relationship.HAS, Entity.LOCATION);
  }

  @Override
  public void prepare(Database database) throws IOException {
    populateService(database);
    setFullyQualifiedName(database);
    populateOwner(database.getOwner()); // Validate owner
  }

  @Override
  public void storeEntity(Database database, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = database.getOwner();
    EntityReference service = database.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    database.withOwner(null).withService(null).withHref(null);

    store(database.getId(), database, update);

    // Restore the relationships
    database.withOwner(owner).withService(service);
  }

  @Override
  public void storeRelationships(Database database) {
    EntityReference service = database.getService();
    addRelationship(service.getId(), database.getId(), service.getType(), Entity.DATABASE, Relationship.CONTAINS);
    storeOwner(database, database.getOwner());
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
    database.setOwner(fields.contains(FIELD_OWNER) ? getOwner(database) : null);
    database.setDatabaseSchemas(fields.contains("databaseSchemas") ? getSchemas(database) : null);
    database.setUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), database.getId()) : null);
    database.setLocation(fields.contains("location") ? getLocation(database) : null);
    return database;
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
    DatabaseService service = getService(database.getService().getId(), database.getService().getType());
    database.setService(service.getEntityReference());
    database.setServiceType(service.getServiceType());
  }

  private DatabaseService getService(UUID serviceId, String entityType) throws IOException {
    if (entityType.equalsIgnoreCase(Entity.DATABASE_SERVICE)) {
      return daoCollection.dbServiceDAO().findEntityById(serviceId);
    }
    throw new IllegalArgumentException(
        CatalogExceptionMessage.invalidServiceEntity(entityType, Entity.DATABASE, Entity.DATABASE_SERVICE));
  }

  @Transaction
  public Status addLocation(UUID databaseId, UUID locationId) throws IOException {
    daoCollection.databaseDAO().findEntityById(databaseId);
    daoCollection.locationDAO().findEntityById(locationId);
    // A database has only one location.
    deleteFrom(databaseId, Entity.DATABASE, Relationship.HAS, Entity.LOCATION);
    addRelationship(databaseId, locationId, Entity.DATABASE, Entity.LOCATION, Relationship.HAS);
    return CREATED;
  }
}
