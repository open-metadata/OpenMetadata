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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.OntologyIriPreviewRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyRelationship;
import org.openmetadata.schema.type.OntologySourceProvenance;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.ontology.OntologySubsetTermSelector.SourceTerm;
import org.openmetadata.service.util.FullyQualifiedName;

final class OntologySubsetDraftFactory {
  private static final double INITIAL_VERSION = 0.1D;
  private final OntologyIriMinter iriMinter;
  private final RelationshipTypeLookup relationshipTypes;
  private final Clock clock;

  OntologySubsetDraftFactory(
      final OntologyIriMinter iriMinter,
      final RelationshipTypeLookup relationshipTypes,
      final Clock clock) {
    this.iriMinter = iriMinter;
    this.relationshipTypes = relationshipTypes;
    this.clock = clock;
  }

  Draft create(
      final Glossary source,
      final Glossary target,
      final List<SourceTerm> sourceTerms,
      final boolean includeRelationships,
      final String user) {
    final List<ClonedTerm> clonedTerms = cloneTerms(source, target, sourceTerms, user);
    final List<OntologyRelationship> relationships =
        includeRelationships ? cloneRelationships(clonedTerms, user) : List.of();
    final List<OntologyChangeOperation> operations = operations(clonedTerms, relationships);
    return new Draft(operations, references(clonedTerms), relationships, provenances(clonedTerms));
  }

  private List<ClonedTerm> cloneTerms(
      final Glossary source,
      final Glossary target,
      final List<SourceTerm> sourceTerms,
      final String user) {
    final List<ClonedTerm> cloned = new ArrayList<>();
    for (final SourceTerm sourceTerm : sourceTerms) {
      final EntityReference parent = targetParent(sourceTerm.term(), cloned);
      final GlossaryTerm targetTerm = cloneTerm(source, target, sourceTerm, parent, user);
      requireUniqueTargetFqn(cloned, targetTerm);
      cloned.add(new ClonedTerm(sourceTerm, targetTerm));
    }
    return List.copyOf(cloned);
  }

  private GlossaryTerm cloneTerm(
      final Glossary source,
      final Glossary target,
      final SourceTerm sourceTerm,
      final EntityReference parent,
      final String user) {
    final GlossaryTerm term = sourceTerm.term();
    final UUID targetId = UUID.randomUUID();
    final String parentFqn =
        parent == null ? target.getFullyQualifiedName() : parent.getFullyQualifiedName();
    return new GlossaryTerm()
        .withId(targetId)
        .withName(term.getName())
        .withDisplayName(displayName(term))
        .withDescription(term.getDescription())
        .withFullyQualifiedName(FullyQualifiedName.add(parentFqn, term.getName()))
        .withGlossary(target.getEntityReference())
        .withParent(parent)
        .withIri(mintIri(target, term.getName(), targetId))
        .withConceptMappings(sourceMappings(source, term))
        .withAttributes(List.copyOf(listOrEmpty(term.getAttributes())))
        .withOntologySource(provenance(source, sourceTerm, user))
        .withVersion(INITIAL_VERSION)
        .withEntityStatus(status(term))
        .withProvider(ProviderType.USER)
        .withUpdatedBy(user)
        .withUpdatedAt(clock.millis());
  }

  private static String displayName(final GlossaryTerm source) {
    final String displayName =
        nullOrEmpty(source.getDisplayName()) ? source.getName() : source.getDisplayName();
    return displayName;
  }

  private static EntityStatus status(final GlossaryTerm source) {
    final EntityStatus status =
        source.getEntityStatus() == null ? EntityStatus.DRAFT : source.getEntityStatus();
    return status;
  }

  private URI mintIri(final Glossary target, final String termName, final UUID candidateId) {
    final OntologyIriPreviewRequest request =
        new OntologyIriPreviewRequest()
            .withGlossaryId(target.getId())
            .withTermName(termName)
            .withCandidateId(candidateId);
    return iriMinter.preview(target, request).getIri();
  }

  private static List<ConceptMapping> sourceMappings(
      final Glossary source, final GlossaryTerm sourceTerm) {
    final List<ConceptMapping> mappings =
        new ArrayList<>(listOrEmpty(sourceTerm.getConceptMappings()));
    if (sourceTerm.getIri() != null && !containsMapping(mappings, sourceTerm.getIri())) {
      mappings.add(
          new ConceptMapping()
              .withConceptIri(sourceTerm.getIri())
              .withMappingType(ConceptMapping.ConceptMappingType.EXACT_MATCH)
              .withSource(source.getName()));
    }
    return List.copyOf(mappings);
  }

  private static boolean containsMapping(final List<ConceptMapping> mappings, final URI sourceIri) {
    return mappings.stream().anyMatch(mapping -> sourceIri.equals(mapping.getConceptIri()));
  }

  private OntologySourceProvenance provenance(
      final Glossary source, final SourceTerm sourceTerm, final String user) {
    return new OntologySourceProvenance()
        .withSourceGlossary(source.getEntityReference())
        .withSourceGlossaryVersion(source.getVersion())
        .withSourceTerm(sourceTerm.term().getEntityReference())
        .withSourceTermVersion(sourceTerm.term().getVersion())
        .withSourceIri(sourceTerm.term().getIri())
        .withSourceSnapshot(OntologyTermStructureMapper.sourceStructure(sourceTerm.term()))
        .withSelectedDirectly(sourceTerm.selectedDirectly())
        .withCapturedAt(clock.millis())
        .withCapturedBy(user);
  }

  private List<OntologyRelationship> cloneRelationships(
      final List<ClonedTerm> clonedTerms, final String user) {
    final RelationshipCloneContext context =
        new RelationshipCloneContext(user, new HashSet<>(), new ArrayList<>());
    for (final ClonedTerm source : clonedTerms) {
      cloneRelationshipsFrom(source, clonedTerms, context);
    }
    return List.copyOf(context.relationships());
  }

  private void cloneRelationshipsFrom(
      final ClonedTerm source,
      final List<ClonedTerm> clonedTerms,
      final RelationshipCloneContext context) {
    for (final TermRelation relation : listOrEmpty(source.source().term().getRelatedTerms())) {
      final ClonedTerm target = findBySourceId(clonedTerms, relation.getTerm().getId());
      if (target != null && relation.getProvenance() != RelationProvenance.INFERRED) {
        addRelationship(source, target, relation, context);
      }
    }
  }

  private void addRelationship(
      final ClonedTerm source,
      final ClonedTerm target,
      final TermRelation relation,
      final RelationshipCloneContext context) {
    final RelationshipType type = relationshipTypes.require(relationTypeName(relation));
    final RelationshipKey key = relationshipKey(source, target, relation, type);
    if (context.copied().add(key)) {
      context.relationships().add(relationship(source, target, type, context.user()));
    }
  }

  private OntologyRelationship relationship(
      final ClonedTerm source,
      final ClonedTerm target,
      final RelationshipType type,
      final String user) {
    return new OntologyRelationship()
        .withId(UUID.randomUUID())
        .withFromTerm(source.target().getEntityReference())
        .withToTerm(target.target().getEntityReference())
        .withRelationshipType(type.getEntityReference())
        .withProvenance(RelationProvenance.IMPORTED)
        .withStatus(EntityStatus.DRAFT)
        .withCreatedBy(user)
        .withCreatedAt(clock.millis());
  }

  private static String relationTypeName(final TermRelation relation) {
    final String name =
        relation.getRelationshipType() == null
            ? relation.getRelationType()
            : relation.getRelationshipType().getName();
    if (nullOrEmpty(name) || name.isBlank()) {
      throw new BadRequestException("Subset source relationship is missing its registered type");
    }
    return name;
  }

  private static RelationshipKey relationshipKey(
      final ClonedTerm source,
      final ClonedTerm target,
      final TermRelation relation,
      final RelationshipType type) {
    final UUID first = minimum(source.source().term().getId(), target.source().term().getId());
    final UUID second = maximum(source.source().term().getId(), target.source().term().getId());
    final String canonicalType = canonicalTypeName(type);
    return new RelationshipKey(relation.getId(), first, second, canonicalType);
  }

  private static String canonicalTypeName(final RelationshipType type) {
    final String inverseName = type.getInverse() == null ? null : type.getInverse().getName();
    final String canonical =
        inverseName == null || type.getName().compareTo(inverseName) <= 0
            ? type.getName()
            : inverseName;
    return canonical;
  }

  private static UUID minimum(final UUID first, final UUID second) {
    return first.compareTo(second) <= 0 ? first : second;
  }

  private static UUID maximum(final UUID first, final UUID second) {
    return first.compareTo(second) >= 0 ? first : second;
  }

  private static EntityReference targetParent(
      final GlossaryTerm source, final List<ClonedTerm> cloned) {
    final UUID parentId = source.getParent() == null ? null : source.getParent().getId();
    final ClonedTerm parent = parentId == null ? null : findBySourceId(cloned, parentId);
    return parent == null ? null : parent.target().getEntityReference();
  }

  private static ClonedTerm findBySourceId(final List<ClonedTerm> cloned, final UUID sourceId) {
    return cloned.stream()
        .filter(candidate -> candidate.source().term().getId().equals(sourceId))
        .findFirst()
        .orElse(null);
  }

  private static void requireUniqueTargetFqn(
      final List<ClonedTerm> cloned, final GlossaryTerm target) {
    final boolean isDuplicate =
        cloned.stream()
            .anyMatch(
                term ->
                    term.target().getFullyQualifiedName().equals(target.getFullyQualifiedName()));
    if (isDuplicate) {
      throw new BadRequestException(
          "Ontology subset produces duplicate target term '"
              + target.getFullyQualifiedName()
              + "'");
    }
  }

  private static List<OntologyChangeOperation> operations(
      final List<ClonedTerm> clonedTerms, final List<OntologyRelationship> relationships) {
    final List<OntologyChangeOperation> operations = new ArrayList<>();
    clonedTerms.stream().map(OntologySubsetDraftFactory::createOperation).forEach(operations::add);
    relationships.stream()
        .map(OntologySubsetDraftFactory::relationshipOperation)
        .forEach(operations::add);
    return List.copyOf(operations);
  }

  private static OntologyChangeOperation createOperation(final ClonedTerm cloned) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.CREATE_TERM)
        .withTerm(cloned.target())
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static OntologyChangeOperation relationshipOperation(
      final OntologyRelationship relationship) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.ADD_RELATIONSHIP)
        .withTargetId(relationship.getFromTerm().getId())
        .withRelationship(relationship)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static List<EntityReference> references(final List<ClonedTerm> clonedTerms) {
    return clonedTerms.stream().map(term -> term.target().getEntityReference()).toList();
  }

  private static List<OntologySourceProvenance> provenances(final List<ClonedTerm> clonedTerms) {
    return clonedTerms.stream().map(term -> term.target().getOntologySource()).toList();
  }

  @FunctionalInterface
  interface RelationshipTypeLookup {
    RelationshipType require(String name);
  }

  record Draft(
      List<OntologyChangeOperation> operations,
      List<EntityReference> terms,
      List<OntologyRelationship> relationships,
      List<OntologySourceProvenance> sources) {
    Draft {
      operations = List.copyOf(operations);
      terms = List.copyOf(terms);
      relationships = List.copyOf(relationships);
      sources = List.copyOf(sources);
    }
  }

  private record ClonedTerm(SourceTerm source, GlossaryTerm target) {}

  private record RelationshipCloneContext(
      String user, Set<RelationshipKey> copied, List<OntologyRelationship> relationships) {}

  private record RelationshipKey(
      UUID edgeId, UUID firstTermId, UUID secondTermId, String canonicalType) {}
}
