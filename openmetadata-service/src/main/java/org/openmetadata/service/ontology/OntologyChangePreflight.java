/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.ontology;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyRelationship;
import org.openmetadata.service.Entity;

public final class OntologyChangePreflight {
  private final EntityLoader entityLoader;

  public OntologyChangePreflight(final EntityLoader entityLoader) {
    this.entityLoader = entityLoader;
  }

  public void validate(
      final OntologyChangeSet changeSet, final List<OntologyChangeOperation> operations) {
    final Set<UUID> scope = glossaryScope(changeSet);
    final List<GlossaryTerm> plannedTerms = plannedTerms(operations);
    final List<VersionGuard> versionGuards = new ArrayList<>();
    for (final OntologyChangeOperation operation : operations) {
      validateScope(operation, scope, plannedTerms);
      validateTargetVersion(operation, plannedTerms, versionGuards);
    }
  }

  private static Set<UUID> glossaryScope(final OntologyChangeSet changeSet) {
    return changeSet.getGlossaries().stream()
        .map(EntityReference::getId)
        .collect(Collectors.toUnmodifiableSet());
  }

  private static List<GlossaryTerm> plannedTerms(final List<OntologyChangeOperation> operations) {
    return operations.stream()
        .filter(
            operation -> operation.getOperationType() == OntologyChangeOperationType.CREATE_TERM)
        .map(OntologyChangeOperation::getTerm)
        .toList();
  }

  private void validateScope(
      final OntologyChangeOperation operation,
      final Set<UUID> scope,
      final List<GlossaryTerm> plannedTerms) {
    switch (operation.getOperationType()) {
      case CREATE_TERM -> validateCreatedTermScope(operation, scope, plannedTerms);
      case UPDATE_TERM,
          DELETE_TERM,
          UPSERT_ATTRIBUTE,
          DELETE_ATTRIBUTE,
          UPSERT_MAPPING,
          DELETE_MAPPING -> requireTermInScope(
          operation, operation.getTargetId(), scope, plannedTerms);
      case ADD_RELATIONSHIP, UPDATE_RELATIONSHIP, DELETE_RELATIONSHIP -> validateRelationshipScope(
          operation, scope, plannedTerms);
      case UPSERT_AXIOM -> validateAxiomScope(operation, scope);
      case DELETE_AXIOM -> requireAxiomInScope(operation, scope);
    }
  }

  private void validateCreatedTermScope(
      final OntologyChangeOperation operation,
      final Set<UUID> scope,
      final List<GlossaryTerm> plannedTerms) {
    final GlossaryTerm term = operation.getTerm();
    requireInScope(operation, term.getGlossary().getId(), scope);
    if (term.getParent() != null) {
      requireTermInScope(operation, term.getParent().getId(), scope, plannedTerms);
    }
  }

  private void validateRelationshipScope(
      final OntologyChangeOperation operation,
      final Set<UUID> scope,
      final List<GlossaryTerm> plannedTerms) {
    final OntologyRelationship relationship = operation.getRelationship();
    requireTermInScope(operation, relationship.getFromTerm().getId(), scope, plannedTerms);
    requireTermInScope(operation, relationship.getToTerm().getId(), scope, plannedTerms);
  }

  private void requireTermInScope(
      final OntologyChangeOperation operation,
      final UUID termId,
      final Set<UUID> scope,
      final List<GlossaryTerm> plannedTerms) {
    final GlossaryTerm plannedTerm = findPlannedTerm(plannedTerms, termId);
    final GlossaryTerm term =
        plannedTerm == null
            ? (GlossaryTerm) entityLoader.load(Entity.GLOSSARY_TERM, termId)
            : plannedTerm;
    requireInScope(operation, term.getGlossary().getId(), scope);
  }

  private void validateAxiomScope(final OntologyChangeOperation operation, final Set<UUID> scope) {
    if (operation.getTargetId() == null) {
      requireInScope(operation, operation.getAxiom().getGlossary().getId(), scope);
    } else {
      requireAxiomInScope(operation, scope);
    }
  }

  private void requireAxiomInScope(final OntologyChangeOperation operation, final Set<UUID> scope) {
    final OntologyAxiom axiom =
        (OntologyAxiom) entityLoader.load(Entity.ONTOLOGY_AXIOM, operation.getTargetId());
    requireInScope(operation, axiom.getGlossary().getId(), scope);
  }

  private static void requireInScope(
      final OntologyChangeOperation operation, final UUID glossaryId, final Set<UUID> scope) {
    if (!scope.contains(glossaryId)) {
      throw new BadRequestException(
          "Ontology operation '"
              + operation.getId()
              + "' targets a glossary outside its change set");
    }
  }

  private void validateTargetVersion(
      final OntologyChangeOperation operation,
      final List<GlossaryTerm> plannedTerms,
      final List<VersionGuard> versionGuards) {
    final OperationTarget target = target(operation);
    if (target != null && findPlannedTerm(plannedTerms, target.id()) == null) {
      validateStoredTarget(operation, target, versionGuards);
    }
  }

  private void validateStoredTarget(
      final OntologyChangeOperation operation,
      final OperationTarget target,
      final List<VersionGuard> versionGuards) {
    final VersionGuard guard = findVersionGuard(versionGuards, target);
    if (guard == null) {
      versionGuards.add(loadVersionGuard(operation, target));
    } else {
      requireVersion(operation, guard.expectedVersion(), operation.getBaseVersion());
    }
  }

  private VersionGuard loadVersionGuard(
      final OntologyChangeOperation operation, final OperationTarget target) {
    final EntityInterface entity = entityLoader.load(target.entityType(), target.id());
    requireVersion(operation, operation.getBaseVersion(), entity.getVersion());
    return new VersionGuard(target, operation.getBaseVersion());
  }

  private static VersionGuard findVersionGuard(
      final List<VersionGuard> guards, final OperationTarget target) {
    return guards.stream().filter(guard -> guard.target().equals(target)).findFirst().orElse(null);
  }

  private static GlossaryTerm findPlannedTerm(
      final List<GlossaryTerm> plannedTerms, final UUID termId) {
    return plannedTerms.stream()
        .filter(term -> term.getId().equals(termId))
        .findFirst()
        .orElse(null);
  }

  private static void requireVersion(
      final OntologyChangeOperation operation,
      final Double expectedVersion,
      final Double actualVersion) {
    if (!Objects.equals(expectedVersion, actualVersion)) {
      throw new BadRequestException(
          "Ontology operation '"
              + operation.getId()
              + "' expected version "
              + expectedVersion
              + " but found "
              + actualVersion);
    }
  }

  private static OperationTarget target(final OntologyChangeOperation operation) {
    final OperationTarget target =
        switch (operation.getOperationType()) {
          case CREATE_TERM -> null;
          case UPSERT_AXIOM -> operation.getTargetId() == null
              ? null
              : new OperationTarget(Entity.ONTOLOGY_AXIOM, operation.getTargetId());
          case DELETE_AXIOM -> new OperationTarget(Entity.ONTOLOGY_AXIOM, operation.getTargetId());
          default -> new OperationTarget(Entity.GLOSSARY_TERM, operation.getTargetId());
        };
    return target;
  }

  private record VersionGuard(OperationTarget target, Double expectedVersion) {}

  public record OperationTarget(String entityType, UUID id) {}

  @FunctionalInterface
  public interface EntityLoader {
    EntityInterface load(String entityType, UUID id);
  }
}
