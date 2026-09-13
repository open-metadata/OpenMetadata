package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.STORED_PROCEDURE;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.metadata.InheritedReferences;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.databases.StoredProcedureResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Repository()
public class StoredProcedureRepository implements EntityPolicy<StoredProcedure> {

  static final String PATCH_FIELDS = "storedProcedureCode,sourceUrl";

  static final String UPDATE_FIELDS = "storedProcedureCode,sourceUrl";

  public StoredProcedureRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                StoredProcedureResource.COLLECTION_PATH,
                STORED_PROCEDURE,
                StoredProcedure.class,
                Entity.getCollectionDAO().storedProcedureDAO()),
            new EntityPolicyContext.WriteFields(PATCH_FIELDS, UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    // Covered by the database service / database / schema delete cascade (search by service.id,
    // field_relationship / tag_usage by the root cleanup() FQN prefix) — see
    // EntityRepository#descendantsCoveredByAncestorCascade.
    context().options().setDescendantsCoveredByAncestorCascade(true);
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
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service");
  }

  @Override
  public void storeEntity(StoredProcedure storedProcedure, boolean update) {
    persistence().store(storedProcedure, update);
  }

  @Override
  public void storeEntities(List<StoredProcedure> storedProcedures) {
    persistence().insertMany(storedProcedures);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<StoredProcedure> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(StoredProcedure::getId).toList();
    deleteToMany(ids, Entity.STORED_PROCEDURE, Relationship.CONTAINS, Entity.DATABASE_SCHEMA);
  }

  @Override
  public void storeRelationships(StoredProcedure storedProcedure) {
    relationshipWrites()
        .add(
            new EntityRelationshipWriter.Edge(
                storedProcedure.getDatabaseSchema().getId(),
                storedProcedure.getId(),
                DATABASE_SCHEMA,
                STORED_PROCEDURE,
                Relationship.CONTAINS),
            EntityRelationshipWriter.Value.EMPTY,
            false);
  }

  @Override
  public void storeEntitySpecificRelationshipsForMany(List<StoredProcedure> entities) {
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
  public void entitySpecificCleanup(StoredProcedure storedProcedure) {
    // When a pipeline is removed , the linege needs to be removed
    context()
        .dependencies()
        .daos()
        .relationshipDAO()
        .deleteLineageBySourcePipeline(
            storedProcedure.getId(),
            LineageDetails.Source.QUERY_LINEAGE.value(),
            Relationship.UPSTREAM.ordinal());
  }

  @Override
  public void setInheritedFields(StoredProcedure storedProcedure, EntityUtil.Fields fields) {
    hydrateParentReferencesForInheritance(List.of(storedProcedure), fields);
    EntityPolicy.super.setInheritedFields(storedProcedure, fields);
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
    // databaseSchema, database and service are default container fields for a stored procedure
    // (service is derived from the parent schema) and must always be populated regardless of the
    // requested fields - mirrors DatabaseSchemaRepository.fetchAndSetDefaultFields.
    Map<UUID, EntityReference> schemaRefs =
        batchFetchContainers(storedProcedures, DATABASE_SCHEMA, Include.ALL);
    if (!schemaRefs.isEmpty()) {
      List<UUID> schemaIds =
          schemaRefs.values().stream().map(EntityReference::getId).distinct().toList();
      var schemaRepository = (DatabaseSchemaRepository) Entity.getEntityRepository(DATABASE_SCHEMA);
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
    EntityPolicy.super.setFieldsInBulk(fields, storedProcedures);
  }

  @Override
  public void setInheritedFields(List<StoredProcedure> entities, EntityUtil.Fields fields) {
    hydrateParentReferencesForInheritance(entities, fields);
    EntityPolicy.super.setInheritedFields(entities, fields);
  }

  @Override
  public String getInheritableFields() {
    return "owners,domains";
  }

  @Override
  public void applyInheritance(
      StoredProcedure entity, EntityUtil.Fields fields, EntityInterface parent) {
    if (!(parent instanceof DatabaseSchema schema)) {
      return;
    }
    InheritedReferences.apply(InheritedReferences.Field.OWNERS, entity, fields, schema);
    InheritedReferences.apply(InheritedReferences.Field.DOMAINS, entity, fields, schema);
  }

  private void setDefaultFields(StoredProcedure storedProcedure) {
    EntityReference schemaRef = relationships().container(storedProcedure.getId(), null);
    if (schemaRef == null || schemaRef.getId() == null) {
      return;
    }
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
  public EntityUpdater<StoredProcedure> getUpdater(
      StoredProcedure original,
      StoredProcedure updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new StoredProcedureUpdater(original, updated, operation).mutation();
  }

  @Override
  public EntityReference getParentReference(StoredProcedure entity) {
    return entity.getDatabaseSchema();
  }

  @Override
  public EntityInterface getParentEntity(StoredProcedure entity, String fields) {
    return Entity.getEntity(entity.getDatabaseSchema(), fields, Include.ALL);
  }

  public void setService(StoredProcedure storedProcedure, EntityReference service) {
    if (service != null && storedProcedure != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  service.getId(),
                  storedProcedure.getId(),
                  service.getType(),
                  STORED_PROCEDURE,
                  Relationship.CONTAINS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
      storedProcedure.setService(service);
    }
  }

  public class StoredProcedureUpdater implements EntitySpecificMutation<StoredProcedure> {

    public StoredProcedureUpdater(
        StoredProcedure original, StoredProcedure updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<StoredProcedure> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "storedProcedureCode",
          () -> {
            // storedProcedureCode is a required field. Cannot be null.
            if (entityUpdate.getUpdated().getStoredProcedureCode() != null) {
              entityUpdate.recordChange(
                  "storedProcedureCode",
                  entityUpdate.getOriginal().getStoredProcedureCode(),
                  entityUpdate.getUpdated().getStoredProcedureCode());
            }
          });
      entityUpdate.compareAndUpdate(
          "storedProcedureType",
          () -> {
            if (entityUpdate.getUpdated().getStoredProcedureType() != null) {
              entityUpdate.recordChange(
                  "storedProcedureType",
                  entityUpdate.getOriginal().getStoredProcedureType(),
                  entityUpdate.getUpdated().getStoredProcedureType());
            }
          });
      entityUpdate.compareAndUpdate(
          "processedLineage",
          () -> {
            updateProcessedLineage(entityUpdate.getOriginal(), entityUpdate.getUpdated());
            entityUpdate.recordChange(
                "processedLineage",
                entityUpdate.getOriginal().getProcessedLineage(),
                entityUpdate.getUpdated().getProcessedLineage());
          });
      entityUpdate.compareAndUpdate(
          "sourceUrl",
          () ->
              entityUpdate.recordChange(
                  "sourceUrl",
                  entityUpdate.getOriginal().getSourceUrl(),
                  entityUpdate.getUpdated().getSourceUrl()));
      entityUpdate.compareAndUpdate(
          "sourceHash",
          () ->
              entityUpdate.recordChange(
                  "sourceHash",
                  entityUpdate.getOriginal().getSourceHash(),
                  entityUpdate.getUpdated().getSourceHash(),
                  false,
                  EntityUtil.objectMatch,
                  false));
    }

    private void updateProcessedLineage(StoredProcedure origSP, StoredProcedure updatedSP) {
      // if schema definition changes make processed lineage false
      if (origSP.getProcessedLineage().booleanValue()
          && origSP.getCode() != null
          && !origSP.getCode().equals(updatedSP.getCode())) {
        updatedSP.setProcessedLineage(false);
      }
    }

    private final EntityUpdater<StoredProcedure> entityUpdate;

    public EntityUpdater<StoredProcedure> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<StoredProcedure> entityContext;

  @Override
  public final EntityPolicyContext<StoredProcedure> context() {
    return entityContext;
  }
}
