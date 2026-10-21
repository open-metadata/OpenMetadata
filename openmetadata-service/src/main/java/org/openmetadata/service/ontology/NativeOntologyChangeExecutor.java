package org.openmetadata.service.ontology;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.UriInfo;
import java.time.Clock;
import java.util.function.Supplier;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.OntologyEntityRepository;
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.ontology.OntologyChangeOperationExecutor.OperationOutcome;

public final class NativeOntologyChangeExecutor {
  private final OntologyRepository ontologies;
  private final OntologyEntityRepository<OntologyConcept> concepts;
  private final OntologyEntityRepository<OntologyProperty> properties;
  private final OntologyEntityRepository<OntologyAxiom> axioms;
  private final Clock clock;

  public NativeOntologyChangeExecutor(
      final OntologyRepository ontologies,
      final OntologyEntityRepository<OntologyConcept> concepts,
      final OntologyEntityRepository<OntologyProperty> properties,
      final OntologyEntityRepository<OntologyAxiom> axioms,
      final Clock clock) {
    this.ontologies = ontologies;
    this.concepts = concepts;
    this.properties = properties;
    this.axioms = axioms;
    this.clock = clock;
  }

  public <R> R inScope(final OntologyChangeSet changeSet, final Supplier<R> work) {
    return ontologies.applyWorkingChanges(
        changeSet.getOntology().getId(), changeSet.getBaseWorkingRevision(), work);
  }

  public OperationOutcome execute(
      final UriInfo uriInfo, final String user, final OntologyChangeOperation operation) {
    return switch (operation.getOperationType()) {
      case UPSERT_CONCEPT -> upsert(concepts, operation, uriInfo, user);
      case UPSERT_PROPERTY -> upsert(properties, operation, uriInfo, user);
      case UPSERT_AXIOM -> upsert(axioms, operation, uriInfo, user);
      case DELETE_CONCEPT -> outcome(
          concepts.delete(user, operation.getTargetId(), false, false).entity());
      case DELETE_PROPERTY -> outcome(
          properties.delete(user, operation.getTargetId(), false, false).entity());
      case DELETE_AXIOM -> outcome(
          axioms.delete(user, operation.getTargetId(), false, false).entity());
      default -> throw new BadRequestException("Unsupported native definition operation");
    };
  }

  private <T extends OntologyDefinition> OperationOutcome upsert(
      final OntologyEntityRepository<T> repository,
      final OntologyChangeOperation operation,
      final UriInfo uriInfo,
      final String user) {
    final T definition =
        JsonUtils.deepCopy(
            NativeOntologyChanges.definition(operation), repository.getEntityClass());
    final boolean update = operation.getTargetId() != null;
    definition.setUpdatedBy(user);
    definition.setUpdatedAt(clock.millis());
    repository.prepareInternal(definition, update);
    if (!update
        && repository
            .getByNameOrNull(
                null,
                definition.getFullyQualifiedName(),
                repository.getFields(""),
                Include.ALL,
                false)
            .isPresent()) {
      throw new BadRequestException(
          "Definition already exists: " + definition.getFullyQualifiedName());
    }
    final T saved = repository.createOrUpdate(uriInfo, definition, user).getEntity();
    if (operation.getSourceMemoryIds() != null) {
      for (final var memoryId : operation.getSourceMemoryIds()) {
        repository.addRelationship(
            saved.getId(),
            memoryId,
            NativeOntologyChanges.entityType(operation),
            Entity.CONTEXT_MEMORY,
            Relationship.DERIVED_FROM);
      }
    }
    return outcome(saved);
  }

  private static OperationOutcome outcome(final OntologyDefinition definition) {
    return new OperationOutcome(definition.getEntityReference(), definition.getVersion());
  }
}
