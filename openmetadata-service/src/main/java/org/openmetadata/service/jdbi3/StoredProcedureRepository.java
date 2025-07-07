package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_SERVICE;
import static org.openmetadata.service.Entity.STORED_PROCEDURE;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.databases.StoredProcedureResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

public class StoredProcedureRepository extends EntityRepository<StoredProcedure> {
  static final String PATCH_FIELDS = "storedProcedureCode,sourceUrl";
  static final String UPDATE_FIELDS = "storedProcedureCode,sourceUrl";

  public StoredProcedureRepository() {
    super(
        StoredProcedureResource.COLLECTION_PATH,
        STORED_PROCEDURE,
        StoredProcedure.class,
        Entity.getCollectionDAO().storedProcedureDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(StoredProcedure storedProcedure) {
    storedProcedure.setFullyQualifiedName(
        FullyQualifiedName.add(
            storedProcedure.getDatabaseSchema().getFullyQualifiedName(),
            storedProcedure.getName()));
  }

  @Override
  public void prepare(StoredProcedure storedProcedure, boolean update) {
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
  protected void entitySpecificCleanup(StoredProcedure storedProcedure) {
    // When a pipeline is removed , the linege needs to be removed
    daoCollection
        .relationshipDAO()
        .deleteLineageBySourcePipeline(
            storedProcedure.getId(),
            LineageDetails.Source.QUERY_LINEAGE.value(),
            Relationship.UPSTREAM.ordinal());
  }

  @Override
  public void setInheritedFields(StoredProcedure storedProcedure, EntityUtil.Fields fields) {
    DatabaseSchema schema =
        Entity.getEntity(
            DATABASE_SCHEMA, storedProcedure.getDatabaseSchema().getId(), "owners,domain", ALL);
    inheritOwners(storedProcedure, fields, schema);
    inheritDomain(storedProcedure, fields, schema);
  }

  @Override
  public void setFields(StoredProcedure storedProcedure, EntityUtil.Fields fields) {
    setDefaultFields(storedProcedure);
    storedProcedure.setFollowers(
        fields.contains(FIELD_FOLLOWERS) ? getFollowers(storedProcedure) : null);
  }

  @Override
  public void clearFields(StoredProcedure storedProcedure, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void setFieldsInBulk(EntityUtil.Fields fields, List<StoredProcedure> storedProcedures) {
    if (storedProcedures.isEmpty()) {
      return;
    }

    // For stored procedures, we need to handle the service field specially
    // because it comes through DatabaseSchema
    if (fields.contains(FIELD_SERVICE)
        || fields.contains("databaseSchema")
        || fields.contains("database")
        || fields.contains("service")) {

      // First, collect all unique schema IDs
      Map<UUID, EntityReference> schemaMap = new HashMap<>();
      for (StoredProcedure sp : storedProcedures) {
        EntityReference schemaRef = getContainer(sp.getId());
        if (schemaRef != null) {
          schemaMap.put(schemaRef.getId(), schemaRef);
        }
      }

      // Batch fetch all database schemas with their service info
      Map<UUID, DatabaseSchema> schemas = new HashMap<>();
      for (UUID schemaId : schemaMap.keySet()) {
        DatabaseSchema schema = Entity.getEntity(DATABASE_SCHEMA, schemaId, "", ALL);
        schemas.put(schemaId, schema);
      }

      // Apply all the fetched data to stored procedures
      for (StoredProcedure sp : storedProcedures) {
        EntityReference schemaRef = getContainer(sp.getId());
        if (schemaRef != null && schemas.containsKey(schemaRef.getId())) {
          DatabaseSchema schema = schemas.get(schemaRef.getId());
          sp.withDatabaseSchema(schemaRef)
              .withDatabase(schema.getDatabase())
              .withService(schema.getService());
        }
      }
    }

    // Bulk fetch followers if needed
    if (fields.contains(FIELD_FOLLOWERS)) {
      for (StoredProcedure sp : storedProcedures) {
        sp.setFollowers(getFollowers(sp));
      }
    }
  }

  private void setDefaultFields(StoredProcedure storedProcedure) {
    EntityReference schemaRef = getContainer(storedProcedure.getId());
    DatabaseSchema schema = Entity.getEntity(schemaRef, "", ALL);
    storedProcedure
        .withDatabaseSchema(schemaRef)
        .withDatabase(schema.getDatabase())
        .withService(schema.getService());
  }

  @Override
  public EntityRepository<StoredProcedure>.EntityUpdater getUpdater(
      StoredProcedure original,
      StoredProcedure updated,
      Operation operation,
      ChangeSource changeSource) {
    return new StoredProcedureUpdater(original, updated, operation);
  }

  @Override
  public EntityInterface getParentEntity(StoredProcedure entity, String fields) {
    return Entity.getEntity(entity.getDatabaseSchema(), fields, Include.ALL);
  }

  public void setService(StoredProcedure storedProcedure, EntityReference service) {
    if (service != null && storedProcedure != null) {
      addRelationship(
          service.getId(),
          storedProcedure.getId(),
          service.getType(),
          STORED_PROCEDURE,
          Relationship.CONTAINS);
      storedProcedure.setService(service);
    }
  }

  public class StoredProcedureUpdater extends EntityUpdater {
    public StoredProcedureUpdater(
        StoredProcedure original, StoredProcedure updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      // storedProcedureCode is a required field. Cannot be null.
      if (updated.getStoredProcedureCode() != null) {
        recordChange(
            "storedProcedureCode",
            original.getStoredProcedureCode(),
            updated.getStoredProcedureCode());
      }
      if (updated.getStoredProcedureType() != null) {
        recordChange(
            "storedProcedureType",
            original.getStoredProcedureType(),
            updated.getStoredProcedureType());
      }
      updateProcessedLineage(original, updated);
      recordChange(
          "processedLineage", original.getProcessedLineage(), updated.getProcessedLineage());
      recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl());
      recordChange("sourceHash", original.getSourceHash(), updated.getSourceHash());
    }

    private void updateProcessedLineage(StoredProcedure origSP, StoredProcedure updatedSP) {
      // if schema definition changes make processed lineage false
      if (origSP.getProcessedLineage().booleanValue()
          && origSP.getCode() != null
          && !origSP.getCode().equals(updatedSP.getCode())) {
        updatedSP.setProcessedLineage(false);
      }
    }
  }
}
