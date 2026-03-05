package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.FIELD_SERVICE;
import static org.openmetadata.service.Entity.STORED_PROCEDURE;

import java.util.ArrayList;
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
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
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
    var schema =
        (DatabaseSchema) getCachedParentOrLoad(storedProcedure.getDatabaseSchema(), "", ALL);
    storedProcedure
        .withDatabaseSchema(schema.getEntityReference())
        .withDatabase(schema.getDatabase())
        .withService(schema.getService())
        .withServiceType(schema.getServiceType());
  }

  @Override
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service");
  }

  @Override
  public void storeEntity(StoredProcedure storedProcedure, boolean update) {
    store(storedProcedure, update);
  }

  @Override
  public void storeEntities(List<StoredProcedure> storedProcedures) {
    storeMany(storedProcedures);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<StoredProcedure> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(StoredProcedure::getId).toList();
    deleteToMany(ids, Entity.STORED_PROCEDURE, Relationship.CONTAINS, Entity.DATABASE_SCHEMA);
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
  protected void storeEntitySpecificRelationshipsForMany(List<StoredProcedure> entities) {
    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (StoredProcedure storedProcedure : entities) {
      if (storedProcedure.getDatabaseSchema() == null
          || storedProcedure.getDatabaseSchema().getId() == null) {
        continue;
      }
      relationships.add(
          newRelationship(
              storedProcedure.getDatabaseSchema().getId(),
              storedProcedure.getId(),
              DATABASE_SCHEMA,
              STORED_PROCEDURE,
              Relationship.CONTAINS));
    }
    bulkInsertRelationships(relationships);
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
    hydrateParentReferencesForInheritance(List.of(storedProcedure), fields);
    super.setInheritedFields(storedProcedure, fields);
  }

  @Override
  public void setFields(
      StoredProcedure storedProcedure,
      EntityUtil.Fields fields,
      RelationIncludes relationIncludes) {
    setDefaultFields(storedProcedure);
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

      Map<UUID, EntityReference> schemaRefs =
          batchFetchContainers(storedProcedures, DATABASE_SCHEMA, Include.ALL);
      if (!schemaRefs.isEmpty()) {
        List<UUID> schemaIds =
            schemaRefs.values().stream().map(EntityReference::getId).distinct().toList();
        var schemaRepository =
            (DatabaseSchemaRepository) Entity.getEntityRepository(DATABASE_SCHEMA);
        List<DatabaseSchema> schemas =
            schemaRepository.getDao().findEntitiesByIds(new ArrayList<>(schemaIds), Include.ALL);
        schemaRepository.setFieldsInBulk(EntityUtil.Fields.EMPTY_FIELDS, schemas);
        Map<UUID, DatabaseSchema> schemaById = new HashMap<>();
        for (DatabaseSchema schema : schemas) {
          schemaById.put(schema.getId(), schema);
        }

        for (StoredProcedure sp : storedProcedures) {
          EntityReference schemaRef = schemaRefs.get(sp.getId());
          if (schemaRef == null) {
            continue;
          }
          DatabaseSchema schema = schemaById.get(schemaRef.getId());
          if (schema != null) {
            sp.withDatabaseSchema(schemaRef)
                .withDatabase(schema.getDatabase())
                .withService(schema.getService());
          }
        }
      }
    }

    super.setFieldsInBulk(fields, storedProcedures);
  }

  @Override
  protected void setInheritedFields(List<StoredProcedure> entities, EntityUtil.Fields fields) {
    hydrateParentReferencesForInheritance(entities, fields);
    super.setInheritedFields(entities, fields);
  }

  @Override
  protected String getInheritableFields() {
    return "owners,domains";
  }

  @Override
  protected void applyInheritance(
      StoredProcedure entity, EntityUtil.Fields fields, EntityInterface parent) {
    if (!(parent instanceof DatabaseSchema schema)) {
      return;
    }
    inheritOwners(entity, fields, schema);
    inheritDomains(entity, fields, schema);
  }

  private void setDefaultFields(StoredProcedure storedProcedure) {
    EntityReference schemaRef = getContainer(storedProcedure.getId());
    DatabaseSchema schema = Entity.getEntity(schemaRef, "", ALL);
    storedProcedure
        .withDatabaseSchema(schemaRef)
        .withDatabase(schema.getDatabase())
        .withService(schema.getService());
  }

  private void hydrateParentReferencesForInheritance(
      List<StoredProcedure> storedProcedures, EntityUtil.Fields fields) {
    if (storedProcedures == null || storedProcedures.isEmpty()) {
      return;
    }
    boolean needsOwners = fields.contains(Entity.FIELD_OWNERS);
    boolean needsDomains = fields.contains("domains");
    if (!needsOwners && !needsDomains) {
      return;
    }

    List<StoredProcedure> missingParentRefs =
        storedProcedures.stream().filter(sp -> sp.getDatabaseSchema() == null).toList();
    if (missingParentRefs.isEmpty()) {
      return;
    }

    Map<UUID, EntityReference> schemaRefs =
        batchFetchContainers(missingParentRefs, DATABASE_SCHEMA, ALL);
    for (StoredProcedure storedProcedure : missingParentRefs) {
      EntityReference schemaRef = schemaRefs.get(storedProcedure.getId());
      if (schemaRef != null) {
        storedProcedure.withDatabaseSchema(schemaRef);
      }
    }
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
  protected EntityReference getParentReference(StoredProcedure entity) {
    return entity.getDatabaseSchema();
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
      compareAndUpdate(
          "storedProcedureCode",
          () -> {
            // storedProcedureCode is a required field. Cannot be null.
            if (updated.getStoredProcedureCode() != null) {
              recordChange(
                  "storedProcedureCode",
                  original.getStoredProcedureCode(),
                  updated.getStoredProcedureCode());
            }
          });
      compareAndUpdate(
          "storedProcedureType",
          () -> {
            if (updated.getStoredProcedureType() != null) {
              recordChange(
                  "storedProcedureType",
                  original.getStoredProcedureType(),
                  updated.getStoredProcedureType());
            }
          });
      compareAndUpdate(
          "processedLineage",
          () -> {
            updateProcessedLineage(original, updated);
            recordChange(
                "processedLineage", original.getProcessedLineage(), updated.getProcessedLineage());
          });
      compareAndUpdate(
          "sourceUrl",
          () -> {
            recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl());
          });
      compareAndUpdate(
          "sourceHash",
          () -> {
            recordChange(
                "sourceHash",
                original.getSourceHash(),
                updated.getSourceHash(),
                false,
                EntityUtil.objectMatch,
                false);
          });
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
