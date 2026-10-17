package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.service.Entity;

/** Typed operations share the memory draft lifecycle, but never the glossary model. */
public final class NativeOntologyChanges {
  private NativeOntologyChanges() {}

  public static String entityType(final OntologyChangeOperation operation) {
    return switch (operation.getOperationType()) {
      case UPSERT_CONCEPT, DELETE_CONCEPT -> Entity.ONTOLOGY_CONCEPT;
      case UPSERT_PROPERTY, DELETE_PROPERTY -> Entity.ONTOLOGY_PROPERTY;
      case UPSERT_AXIOM, DELETE_AXIOM -> Entity.ONTOLOGY_AXIOM;
      default -> throw new BadRequestException(
          "Native ontology drafts require definition operations");
    };
  }

  public static boolean isDelete(final OntologyChangeOperation operation) {
    return switch (operation.getOperationType()) {
      case DELETE_CONCEPT, DELETE_PROPERTY, DELETE_AXIOM -> true;
      default -> false;
    };
  }

  public static OntologyDefinition definition(final OntologyChangeOperation operation) {
    return switch (operation.getOperationType()) {
      case UPSERT_CONCEPT -> operation.getConcept();
      case UPSERT_PROPERTY -> operation.getProperty();
      case UPSERT_AXIOM -> operation.getAxiom();
      default -> null;
    };
  }

  static void validate(final OntologyChangeSet changeSet, final int cursor) {
    if (!listOrEmpty(changeSet.getGlossaries()).isEmpty()
        || !Entity.ONTOLOGY.equals(changeSet.getOntology().getType())
        || changeSet.getOntology().getId() == null
        || changeSet.getBaseWorkingRevision() == null
        || changeSet.getBaseWorkingRevision() < 0) {
      throw new BadRequestException(
          "Native drafts require one ontology and its baseWorkingRevision");
    }
    final var operations = listOrEmpty(changeSet.getOperations());
    if (operations.size() > 1000) {
      throw new BadRequestException("A native draft accepts at most 1000 operations");
    }
    final Set<UUID> operationIds = new HashSet<>();
    final Set<UUID> definitionIds = new HashSet<>();
    for (int index = 0; index < operations.size(); index++) {
      final OntologyChangeOperation operation = operations.get(index);
      if (operation == null
          || operation.getId() == null
          || operation.getOperationType() == null
          || !operationIds.add(operation.getId())) {
        throw new BadRequestException("Every ontology operation requires a unique id and type");
      }
      entityType(operation);
      validatePayload(changeSet, operation);
      final UUID id =
          operation.getTargetId() == null ? definition(operation).getId() : operation.getTargetId();
      if (!definitionIds.add(id)) {
        throw new BadRequestException("A native draft may change each definition only once");
      }
      operation.setState(
          index < cursor
              ? OntologyChangeOperationState.ACTIVE
              : OntologyChangeOperationState.UNDONE);
    }
  }

  private static void validatePayload(
      final OntologyChangeSet changeSet, final OntologyChangeOperation operation) {
    final OntologyDefinition definition = definition(operation);
    final int count = OntologyChangeSetValidator.payloadCount(operation);
    if (isDelete(operation)) {
      if (count != 0 || operation.getTargetId() == null) {
        throw new BadRequestException("A definition delete requires a targetId and no payload");
      }
    } else {
      if (count != 1
          || definition == null
          || definition.getId() == null
          || definition.getName() == null
          || definition.getName().isBlank()
          || definition.getOntology() == null
          || !Entity.ONTOLOGY.equals(definition.getOntology().getType())
          || !changeSet.getOntology().getId().equals(definition.getOntology().getId())) {
        throw new BadRequestException("A definition payload must belong to the draft's ontology");
      }
      if (operation.getTargetId() != null && !operation.getTargetId().equals(definition.getId())) {
        throw new BadRequestException("targetId must match the definition id");
      }
    }
    if ((operation.getTargetId() == null) != (operation.getBaseVersion() == null)) {
      throw new BadRequestException(
          "Existing definitions require targetId and baseVersion; new definitions require neither");
    }
  }

  static void validateTarget(
      final OntologyChangeSet changeSet,
      final OntologyChangeOperation operation,
      final OntologyChangePreflight.EntityLoader loader) {
    if (operation.getTargetId() == null) {
      return;
    }
    final OntologyDefinition current =
        (OntologyDefinition) loader.load(entityType(operation), operation.getTargetId());
    if (!changeSet.getOntology().getId().equals(current.getOntology().getId())
        || !Objects.equals(operation.getBaseVersion(), current.getVersion())
        || Boolean.TRUE.equals(current.getDeleted())) {
      throw new BadRequestException(
          "Definition is deleted, outside the draft's ontology, or has changed since drafting");
    }
    final OntologyDefinition proposed = definition(operation);
    if (proposed != null && !current.getName().equals(proposed.getName())) {
      throw new BadRequestException("A draft cannot rename a definition");
    }
  }
}
