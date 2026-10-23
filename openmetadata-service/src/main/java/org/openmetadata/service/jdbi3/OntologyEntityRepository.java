package org.openmetadata.service.jdbi3;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.json.JsonPatch;
import java.net.URI;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.OntologyEntityInterface;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyIriMinter;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

/** Common persistence and lifecycle invariants for independent ontology definitions. */
public abstract class OntologyEntityRepository<T extends OntologyDefinition>
    extends EntityRepository<T> {
  private final List<String> definitionFields;
  protected final OntologyWorkingState workingState;

  protected OntologyEntityRepository(
      final String entityType,
      final Class<T> entityClass,
      final EntityDAO<T> dao,
      final String collectionPath,
      final String definitionFields) {
    super(collectionPath, entityType, entityClass, dao, definitionFields, definitionFields);
    this.definitionFields = List.of(definitionFields.split(","));
    workingState = new OntologyWorkingState(daoCollection);
  }

  @Override
  public void prepare(final T entity, final boolean update) {
    if (entity.getOntology() != null) {
      final EntityReference reference = entity.getOntology();
      if (!Entity.ONTOLOGY.equals(reference.getType())) {
        throw new BadRequestException("Ontology definitions must belong to an ontology");
      }
      final Ontology ontology =
          Entity.getEntity(Entity.ONTOLOGY, reference.getId(), "", Include.NON_DELETED);
      entity.setOntology(ontology.getEntityReference());
      if (entity instanceof OntologyEntityInterface definition) {
        initializeIri(definition, ontology);
      }
    } else if (!Entity.ONTOLOGY.equals(entityType)) {
      throw new BadRequestException("An owning ontology is required");
    }
    if (entity instanceof OntologyEntityInterface definition) {
      requireAbsoluteIri(definition.getIri(), "iri");
    }
    validateDefinition(entity);
  }

  private void initializeIri(final OntologyEntityInterface entity, final Ontology ontology) {
    if (entity.getIri() == null) {
      final T existing =
          findByNameOrNull(
              FullyQualifiedName.add(ontology.getFullyQualifiedName(), entity.getName()),
              Include.ALL);
      entity.setIri(
          existing == null
              ? OntologyIriMinter.mint(ontology.getNamespace(), entity.getId())
              : ((OntologyEntityInterface) existing).getIri());
    }
  }

  protected abstract void validateDefinition(T entity);

  protected static void requireAbsoluteIri(final URI iri, final String field) {
    if (iri == null || !iri.isAbsolute()) {
      throw new BadRequestException("Ontology " + field + " must be an absolute IRI");
    }
  }

  @Override
  public void setFullyQualifiedName(final T entity) {
    entity.setFullyQualifiedName(
        entity.getOntology() == null
            ? FullyQualifiedName.build(entity.getName())
            : FullyQualifiedName.add(
                entity.getOntology().getFullyQualifiedName(), entity.getName()));
  }

  @Override
  protected EntityReference getParentReference(final T entity) {
    return entity.getOntology();
  }

  @Override
  public Ontology getParentEntity(final T entity, final String fields) {
    return entity.getOntology() == null
        ? null
        : Entity.getEntity(entity.getOntology(), fields, Include.ALL);
  }

  @Override
  protected String getInheritableFields() {
    return Entity.ONTOLOGY_RELEASE.equals(entityType) ? "owners,reviewers" : "owners";
  }

  @Override
  protected boolean requiresParentForInheritance(final T entity, final Fields fields) {
    return entity.getOntology() != null
        && ((Entity.ONTOLOGY_RELEASE.equals(entityType) && fields.contains("reviewers"))
            || requiresParentForOwnersOrDomains(entity, fields));
  }

  @Override
  protected void applyInheritance(
      final T entity, final Fields fields, final EntityInterface<?> parent) {
    inheritOwners(entity, fields, parent);
    if (Entity.ONTOLOGY_RELEASE.equals(entityType)) {
      inheritReviewers(entity, fields, getParentEntity(entity, "reviewers"));
    }
  }

  @Override
  public void setFields(final T entity, final Fields fields, final RelationIncludes includes) {}

  @Override
  public void clearFields(final T entity, final Fields fields) {}

  @Override
  public void storeEntity(final T entity, final boolean update) {
    store(entity, update);
  }

  @Override
  protected <R> R executeEntityWrite(final List<T> entities, final Supplier<R> work) {
    return executeInTransaction(() -> workingState.mutate(dao, entities, work));
  }

  @Override
  protected void flushInOneTransaction(final Runnable work) {
    executeInTransaction(
        () -> {
          work.run();
          return null;
        });
  }

  @Override
  public void storeRelationships(final T entity) {
    if (entity.getOntology() != null) {
      addRelationship(
          entity.getOntology().getId(),
          entity.getId(),
          Entity.ONTOLOGY,
          entityType,
          Relationship.CONTAINS);
    }
  }

  @Override
  protected void validatePatch(final T original, final T updated, final JsonPatch patch) {
    if (updated instanceof OntologyEntityInterface definition) {
      requireAbsoluteIri(definition.getIri(), "iri");
    }
    requireUnchangedName(original, updated);
  }

  private void requireUnchangedName(final T original, final T updated) {
    if (!Objects.equals(original.getName(), updated.getName())) {
      throw new BadRequestException(
          "Ontology definition names are immutable; change the display name instead");
    }
  }

  @Override
  public EntityUpdater getUpdater(
      final T original, final T updated, final Operation operation, final ChangeSource source) {
    if (operation.isPut() && Boolean.TRUE.equals(original.getDeleted())) {
      useRestoredRevision(original);
    }
    return newUpdater(original, updated, operation, source);
  }

  protected OntologyUpdater newUpdater(
      final T original, final T updated, final Operation operation, final ChangeSource source) {
    return new OntologyUpdater(original, updated, operation, source);
  }

  private void useRestoredRevision(final T original) {
    final T current = find(original.getId(), Include.ALL);
    if (!Boolean.TRUE.equals(current.getDeleted())) {
      // PUT restores first, within the same ontology lock; compare the edit to that revision.
      original.setVersion(current.getVersion());
      original.setUpdatedAt(current.getUpdatedAt());
      original.setDeleted(false);
    }
  }

  protected class OntologyUpdater extends EntityUpdater {
    protected OntologyUpdater(
        final T original, final T updated, final Operation operation, final ChangeSource source) {
      super(original, updated, operation, source);
      setUseOptimisticLocking(true);
    }

    @Override
    void updateEntityStatus(final boolean consolidatingChanges) {
      // Only immutable releases have an approval status.
    }

    @Override
    protected void entitySpecificUpdate(final boolean consolidatingChanges) {
      requireUnchangedIdentity();
      setInheritedFields(updated, getFields(getInheritableFields()));
      final JsonNode before = JsonUtils.getObjectMapper().valueToTree(original);
      final JsonNode after = JsonUtils.getObjectMapper().valueToTree(updated);
      for (final String field : definitionFields) {
        recordChange(field, before.get(field), after.get(field), true);
      }
    }

    private void requireUnchangedIdentity() {
      requireUnchangedName(original, updated);
      if (original instanceof OntologyEntityInterface definition
          && !Objects.equals(
              definition.getIri().toString(),
              ((OntologyEntityInterface) updated).getIri().toString())) {
        throw new BadRequestException("An ontology definition's semantic IRI is immutable");
      }
      final EntityReference before = original.getOntology();
      final EntityReference after = updated.getOntology();
      if (!Objects.equals(
          before == null ? null : before.getId(), after == null ? null : after.getId())) {
        throw new BadRequestException("An ontology definition cannot move between ontologies");
      }
    }
  }
}
