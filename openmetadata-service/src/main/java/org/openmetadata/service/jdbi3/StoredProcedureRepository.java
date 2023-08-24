package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.STORED_PROCEDURE;

import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.databases.StoredProcedureResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

public class StoredProcedureRepository extends EntityRepository<StoredProcedure> {
  public StoredProcedureRepository(CollectionDAO dao) {
    super(
        StoredProcedureResource.COLLECTION_PATH,
        Entity.SEARCH_INDEX,
        StoredProcedure.class,
        dao.storedProcedureDAO(),
        dao,
        "",
        "");
  }

  @Override
  public void setFullyQualifiedName(StoredProcedure storedProcedure) {
    storedProcedure.setFullyQualifiedName(
        FullyQualifiedName.add(storedProcedure.getDatabaseSchema().getFullyQualifiedName(), storedProcedure.getName()));
  }

  @Override
  public void prepare(StoredProcedure storedProcedure) {
    DatabaseSchema schema = Entity.getEntity(storedProcedure.getDatabaseSchema(), "", ALL);
    storedProcedure
        .withDatabaseSchema(schema.getEntityReference())
        .withDatabase(schema.getDatabase())
        .withService(schema.getService())
        .withServiceType(schema.getServiceType());
  }

  @Override
  public void storeEntity(StoredProcedure storedProcedure, boolean update) {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference service = storedProcedure.getService();
    storedProcedure.withService(null);
    store(storedProcedure, update);
    storedProcedure.withService(service);
  }

  @Override
  public void storeRelationships(StoredProcedure storedProcedure) {
    addRelationship(
        storedProcedure.getDatabaseSchema().getId(),
        storedProcedure.getId(),
        DATABASE_SCHEMA,
        STORED_PROCEDURE,
        Relationship.CONTAINS);
  }

  @Override
  public StoredProcedure setInheritedFields(StoredProcedure storedProcedure, EntityUtil.Fields fields) {
    DatabaseSchema schema =
        Entity.getEntity(DATABASE_SCHEMA, storedProcedure.getDatabaseSchema().getId(), "owner,domain", ALL);
    inheritOwner(storedProcedure, fields, schema);
    inheritDomain(storedProcedure, fields, schema);
    return storedProcedure;
  }

  @Override
  public StoredProcedure setFields(StoredProcedure storedProcedure, EntityUtil.Fields fields) {
    storedProcedure.setService(getContainer(storedProcedure.getDatabaseSchema().getId()));
    storedProcedure.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(storedProcedure) : null);
    return storedProcedure;
  }

  @Override
  public StoredProcedure clearFields(StoredProcedure storedProcedure, EntityUtil.Fields fields) {
    return storedProcedure;
  }

  @Override
  public StoredProcedureUpdater getUpdater(StoredProcedure original, StoredProcedure updated, Operation operation) {
    return new StoredProcedureUpdater(original, updated, operation);
  }

  public void setService(SearchIndex searchIndex, EntityReference service) {
    if (service != null && searchIndex != null) {
      addRelationship(
          service.getId(), searchIndex.getId(), service.getType(), Entity.SEARCH_INDEX, Relationship.CONTAINS);
      searchIndex.setService(service);
    }
  }

  public class StoredProcedureUpdater extends EntityUpdater {
    public StoredProcedureUpdater(StoredProcedure original, StoredProcedure updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() {
      recordChange("storedProcedureCode", original.getStoredProcedureCode(), updated.getStoredProcedureCode());
    }
  }
}
