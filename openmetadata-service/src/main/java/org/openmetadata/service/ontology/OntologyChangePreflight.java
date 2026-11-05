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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyRelationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.rdf.OwlEntityDeclarations;

public final class OntologyChangePreflight {
  private final EntityLoader entityLoader;
  private final DeclaredConcepts declaredConcepts;

  public OntologyChangePreflight(
      final EntityLoader entityLoader, final DeclaredConcepts declaredConcepts) {
    this.entityLoader = entityLoader;
    this.declaredConcepts = declaredConcepts;
  }

  /** Glossary change sets never read ontology concepts. */
  public OntologyChangePreflight(final EntityLoader entityLoader) {
    this(entityLoader, (ontologyId, iris) -> Set.of());
  }

  public void validate(
      final OntologyChangeSet changeSet, final List<OntologyChangeOperation> operations) {
    final Map<UUID, Boolean> activeSourceMemories =
        Caffeine.newBuilder().maximumSize(1000).<UUID, Boolean>build().asMap();
    if (changeSet.getOntology() != null) {
      for (final OntologyChangeOperation operation : operations) {
        validateSourceMemories(operation, activeSourceMemories);
        NativeOntologyChanges.validateTarget(changeSet, operation, entityLoader);
      }
      requireReferencedConcepts(changeSet.getOntology().getId(), operations);
      return;
    }
    final Set<UUID> scope = glossaryScope(changeSet);
    final List<GlossaryTerm> plannedTerms = plannedTerms(operations);
    final List<VersionGuard> versionGuards = new ArrayList<>();
    for (final OntologyChangeOperation operation : operations) {
      validateSourceMemories(operation, activeSourceMemories);
      validateScope(operation, scope, plannedTerms);
      validateTargetVersion(operation, plannedTerms, versionGuards);
    }
  }

  /**
   * An operation needs the classes at the positions the importer validates, read from the operation
   * itself because requiresConceptIris is optional and a partial import can drop it, plus every IRI
   * it declares in requiresConceptIris, which covers individuals that no class position names. A
   * need is met by a vocabulary class, an UPSERT_CONCEPT in the set, or a concept the ontology
   * declares. Datatypes are skipped because the set may not carry the data property whose filler
   * names one, and a datatype is never a concept.
   */
  private void requireReferencedConcepts(
      final UUID ontologyId, final List<OntologyChangeOperation> operations) {
    final Set<String> created =
        operations.stream()
            .filter(
                operation ->
                    operation.getOperationType() == OntologyChangeOperationType.UPSERT_CONCEPT
                        && operation.getConcept() != null)
            .map(operation -> operation.getConcept().getIri().toString())
            .collect(Collectors.toSet());
    final Predicate<URI> isDataProperty = dataProperties(operations);
    final Map<OntologyChangeOperation, Set<String>> unresolved = new LinkedHashMap<>();
    for (final OntologyChangeOperation operation : operations) {
      final Set<String> missing = new TreeSet<>(classPositions(operation, isDataProperty));
      if (operation.getRequiresConceptIris() != null) {
        operation.getRequiresConceptIris().forEach(iri -> missing.add(iri.toString()));
      }
      missing.removeIf(
          iri ->
              created.contains(iri)
                  || OntologyClassHierarchy.isVocabularyClass(iri)
                  || OwlEntityDeclarations.isDatatype(iri));
      if (!missing.isEmpty()) {
        unresolved.put(operation, missing);
      }
    }
    if (unresolved.isEmpty()) {
      return;
    }
    final Set<String> declared =
        declaredConcepts.declared(
            ontologyId,
            unresolved.values().stream().flatMap(Set::stream).collect(Collectors.toSet()));
    unresolved.forEach(
        (operation, missing) -> {
          missing.removeAll(declared);
          if (!missing.isEmpty()) {
            throw new BadRequestException(
                "Ontology operation '"
                    + operation.getId()
                    + "' needs the concept "
                    + missing.iterator().next()
                    + ", which is not part of this change set");
          }
        });
  }

  private static Set<String> classPositions(
      final OntologyChangeOperation operation, final Predicate<URI> isDataProperty) {
    final List<OntologyClassHierarchy.ClassPosition> positions =
        switch (operation.getOperationType()) {
          case UPSERT_AXIOM -> OntologyClassHierarchy.classPositions(
              operation.getAxiom(),
              isDataProperty,
              () -> {
                throw new BadRequestException(
                    "Ontology operation '"
                        + operation.getId()
                        + "' has a class expression with more than 10000 steps");
              });
          case UPSERT_PROPERTY -> OntologyClassHierarchy.classPositions(operation.getProperty());
          default -> List.of();
        };
    return positions.stream()
        .map(OntologyClassHierarchy.ClassPosition::iri)
        .filter(Objects::nonNull)
        .map(URI::toString)
        .collect(Collectors.toSet());
  }

  private static Predicate<URI> dataProperties(final List<OntologyChangeOperation> operations) {
    final Map<String, OntologyProperty> inSet = new HashMap<>();
    operations.stream()
        .filter(
            operation ->
                operation.getOperationType() == OntologyChangeOperationType.UPSERT_PROPERTY)
        .map(OntologyChangeOperation::getProperty)
        .filter(property -> property.getIri() != null)
        .forEach(property -> inSet.putIfAbsent(property.getIri().toString(), property));
    return iri -> OntologyClassHierarchy.isDataProperty(iri, inSet);
  }

  /**
   * An operation stays applicable while one of its source memories still grounds it. A batch draft
   * puts every memory on its CREATE_GLOSSARY operation and merges co-sources onto shared terms, so
   * requiring all of them would let one retired memory block the whole draft.
   */
  private void validateSourceMemories(
      final OntologyChangeOperation operation, final Map<UUID, Boolean> activeSourceMemories) {
    final Set<UUID> sources = operation.getSourceMemoryIds();
    if (!nullOrEmpty(sources)
        && sources.stream()
            .noneMatch(id -> activeSourceMemories.computeIfAbsent(id, this::isActiveSource))) {
      throw new BadRequestException(
          "Ontology operation '" + operation.getId() + "' has no active source memory left");
    }
  }

  private boolean isActiveSource(final UUID memoryId) {
    boolean active;
    try {
      final ContextMemory memory =
          (ContextMemory) entityLoader.load(Entity.CONTEXT_MEMORY, memoryId);
      active =
          !Boolean.TRUE.equals(memory.getDeleted())
              && memory.getEntityStatus() == ContextMemoryStatus.APPROVED;
    } catch (EntityNotFoundException e) {
      active = false;
    }
    return active;
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
      case CREATE_GLOSSARY -> requireInScope(operation, operation.getGlossary().getId(), scope);
      case CREATE_TERM -> validateCreatedTermScope(operation, scope, plannedTerms);
      case UPDATE_TERM, DELETE_TERM, UPSERT_MAPPING, DELETE_MAPPING -> requireTermInScope(
          operation, operation.getTargetId(), scope, plannedTerms);
      case ADD_RELATIONSHIP, UPDATE_RELATIONSHIP, DELETE_RELATIONSHIP -> validateRelationshipScope(
          operation, scope, plannedTerms);
      case UPSERT_CONCEPT,
          DELETE_CONCEPT,
          UPSERT_PROPERTY,
          DELETE_PROPERTY,
          UPSERT_AXIOM,
          DELETE_AXIOM -> throw new BadRequestException(
          "Axioms must be authored in an ontology, not a glossary change set");
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
    final EntityInterface<?> entity = entityLoader.load(target.entityType(), target.id());
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
          case CREATE_GLOSSARY, CREATE_TERM -> null;
          case UPSERT_AXIOM, DELETE_AXIOM -> null;
          default -> new OperationTarget(Entity.GLOSSARY_TERM, operation.getTargetId());
        };
    return target;
  }

  private record VersionGuard(OperationTarget target, Double expectedVersion) {}

  public record OperationTarget(String entityType, UUID id) {}

  /** The subset of these IRIs that live concepts of the ontology declare. */
  @FunctionalInterface
  public interface DeclaredConcepts {
    Set<String> declared(UUID ontologyId, Set<String> iris);
  }

  @FunctionalInterface
  public interface EntityLoader {
    EntityInterface<?> load(String entityType, UUID id);
  }
}
