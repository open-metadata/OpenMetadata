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
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.invalid;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.mappingType;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.optionalAbsoluteIri;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.requireAbsoluteIri;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.requireAllowedId;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.requireCompletion;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.requireConfidence;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.requireText;

import java.net.URI;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.OntologyMappingSuggestion;
import org.openmetadata.schema.api.data.OntologyMappingSuggestionRequest;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestion;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestionRequest;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyRelationship;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.SemanticReference;

final class OntologyAiProposalFactory {
  private static final String GENERATED_BY = "ask-collate";
  private final Clock clock;

  OntologyAiProposalFactory(final Clock clock) {
    this.clock = clock;
  }

  OntologyAiCompletionGateway.RelationshipPrompt relationshipPrompt(
      final OntologyRelationshipSuggestionRequest request,
      final List<GlossaryTerm> sources,
      final List<GlossaryTerm> candidates,
      final List<RelationshipType> relationshipTypes) {
    return new OntologyAiCompletionGateway.RelationshipPrompt(
        sources.stream().map(OntologyAiProposalFactory::termContext).toList(),
        candidates.stream().map(OntologyAiProposalFactory::termContext).toList(),
        relationshipTypes.stream().map(OntologyAiProposalFactory::relationshipTypeContext).toList(),
        request.getInstructions(),
        request.getMaxSuggestions());
  }

  OntologyAiCompletionGateway.MappingPrompt mappingPrompt(
      final OntologyMappingSuggestionRequest request, final List<GlossaryTerm> sources) {
    return new OntologyAiCompletionGateway.MappingPrompt(
        sources.stream().map(OntologyAiProposalFactory::termContext).toList(),
        List.copyOf(request.getStandards()),
        request.getInstructions(),
        request.getMaxSuggestions());
  }

  List<OntologyRelationshipSuggestion> relationships(
      final OntologyAiCompletionGateway.Completion<
              OntologyAiCompletionGateway.RelationshipCandidate>
          completion,
      final OntologyRelationshipSuggestionRequest request,
      final List<GlossaryTerm> sources,
      final List<GlossaryTerm> candidates,
      final List<RelationshipType> relationshipTypes) {
    requireCompletion(completion);
    final Set<RelationshipKey> seen = new HashSet<>();
    final List<OntologyRelationshipSuggestion> suggestions = new ArrayList<>();
    for (final OntologyAiCompletionGateway.RelationshipCandidate candidate : completion.items()) {
      final RelationshipKey key = validateRelationship(candidate, request);
      if (seen.add(key) && suggestions.size() < request.getMaxSuggestions()) {
        suggestions.add(relationship(candidate, sources, candidates, relationshipTypes));
      }
    }
    return List.copyOf(suggestions);
  }

  List<OntologyMappingSuggestion> mappings(
      final OntologyAiCompletionGateway.Completion<OntologyAiCompletionGateway.MappingCandidate>
          completion,
      final OntologyMappingSuggestionRequest request,
      final List<GlossaryTerm> sources) {
    requireCompletion(completion);
    final Set<MappingKey> seen = new HashSet<>();
    final List<OntologyMappingSuggestion> suggestions = new ArrayList<>();
    for (final OntologyAiCompletionGateway.MappingCandidate candidate : completion.items()) {
      final ValidatedMapping mapping = validateMapping(candidate, request);
      if (seen.add(mapping.key()) && suggestions.size() < request.getMaxSuggestions()) {
        suggestions.add(mapping(candidate, mapping.mapping(), sources));
      }
    }
    return List.copyOf(suggestions);
  }

  private OntologyRelationshipSuggestion relationship(
      final OntologyAiCompletionGateway.RelationshipCandidate candidate,
      final List<GlossaryTerm> sources,
      final List<GlossaryTerm> candidates,
      final List<RelationshipType> relationshipTypes) {
    final GlossaryTerm source = requireTerm(sources, candidate.sourceTermId());
    final GlossaryTerm target = requireTerm(candidates, candidate.targetTermId());
    final RelationshipType type = requireType(relationshipTypes, candidate.relationshipTypeId());
    final OntologyRelationship relationship = relationship(source, target, type);
    return new OntologyRelationshipSuggestion()
        .withId(UUID.randomUUID())
        .withOperation(relationshipOperation(source, relationship))
        .withConfidence(candidate.confidence())
        .withRationale(candidate.rationale());
  }

  private OntologyRelationship relationship(
      final GlossaryTerm source, final GlossaryTerm target, final RelationshipType type) {
    return new OntologyRelationship()
        .withId(UUID.randomUUID())
        .withFromTerm(source.getEntityReference())
        .withToTerm(target.getEntityReference())
        .withRelationshipType(type.getEntityReference())
        .withProvenance(RelationProvenance.AI_SUGGESTED)
        .withStatus(EntityStatus.DRAFT)
        .withCreatedBy(GENERATED_BY)
        .withCreatedAt(clock.millis());
  }

  private static OntologyChangeOperation relationshipOperation(
      final GlossaryTerm source, final OntologyRelationship relationship) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.ADD_RELATIONSHIP)
        .withTargetId(source.getId())
        .withBaseVersion(source.getVersion())
        .withRelationship(relationship)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static OntologyMappingSuggestion mapping(
      final OntologyAiCompletionGateway.MappingCandidate candidate,
      final ConceptMapping mapping,
      final List<GlossaryTerm> sources) {
    final GlossaryTerm source = requireTerm(sources, candidate.sourceTermId());
    return new OntologyMappingSuggestion()
        .withId(UUID.randomUUID())
        .withOperation(mappingOperation(source, mapping))
        .withTargetLabel(candidate.targetLabel())
        .withConfidence(candidate.confidence())
        .withRationale(candidate.rationale());
  }

  private static OntologyChangeOperation mappingOperation(
      final GlossaryTerm source, final ConceptMapping mapping) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPSERT_MAPPING)
        .withTargetId(source.getId())
        .withBaseVersion(source.getVersion())
        .withMapping(mapping)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static RelationshipKey validateRelationship(
      final OntologyAiCompletionGateway.RelationshipCandidate candidate,
      final OntologyRelationshipSuggestionRequest request) {
    requireAllowedId(candidate.sourceTermId(), request.getSourceTermIds(), "source term");
    requireAllowedId(candidate.targetTermId(), request.getCandidateTermIds(), "target term");
    requireAllowedId(
        candidate.relationshipTypeId(), request.getRelationshipTypeIds(), "relationship type");
    if (candidate.sourceTermId().equals(candidate.targetTermId())) {
      throw invalid("relationship source and target must be different");
    }
    requireConfidence(candidate.confidence());
    requireText(candidate.rationale(), "relationship rationale");
    return new RelationshipKey(
        candidate.sourceTermId(), candidate.targetTermId(), candidate.relationshipTypeId());
  }

  private static ValidatedMapping validateMapping(
      final OntologyAiCompletionGateway.MappingCandidate candidate,
      final OntologyMappingSuggestionRequest request) {
    requireAllowedId(candidate.sourceTermId(), request.getSourceTermIds(), "source term");
    final URI conceptIri = requireAbsoluteIri(candidate.conceptIri(), "concept IRI");
    final URI schemeIri = optionalAbsoluteIri(candidate.schemeIri(), "scheme IRI");
    final ConceptMapping.ConceptMappingType type = mappingType(candidate.mappingType());
    requireConfidence(candidate.confidence());
    requireText(candidate.targetLabel(), "mapping target label");
    requireText(candidate.rationale(), "mapping rationale");
    final ConceptMapping mapping =
        new ConceptMapping()
            .withConceptIri(conceptIri)
            .withMappingType(type)
            .withSchemeIri(schemeIri)
            .withSource(candidate.source());
    return new ValidatedMapping(
        new MappingKey(candidate.sourceTermId(), conceptIri, type, schemeIri), mapping);
  }

  private static OntologyAiCompletionGateway.TermContext termContext(final GlossaryTerm term) {
    return new OntologyAiCompletionGateway.TermContext(
        term.getId(),
        term.getName(),
        Objects.requireNonNullElse(term.getDescription(), ""),
        term.getVersion());
  }

  private static OntologyAiCompletionGateway.RelationshipTypeContext relationshipTypeContext(
      final RelationshipType type) {
    return new OntologyAiCompletionGateway.RelationshipTypeContext(
        type.getId(),
        type.getName(),
        Objects.requireNonNullElse(type.getDisplayName(), type.getName()),
        type.getRdfPredicate().toString(),
        semanticIris(type.getDomain()),
        semanticIris(type.getRange()));
  }

  private static String semanticIris(final Set<SemanticReference> references) {
    final String joined =
        nullOrEmpty(references)
            ? ""
            : references.stream()
                .map(reference -> reference.getIri().toString())
                .sorted()
                .collect(Collectors.joining(", "));
    return joined;
  }

  private static GlossaryTerm requireTerm(final List<GlossaryTerm> terms, final UUID id) {
    return terms.stream()
        .filter(term -> term.getId().equals(id))
        .findFirst()
        .orElseThrow(() -> invalid("completion referenced an unavailable term"));
  }

  private static RelationshipType requireType(final List<RelationshipType> types, final UUID id) {
    return types.stream()
        .filter(type -> type.getId().equals(id))
        .findFirst()
        .orElseThrow(() -> invalid("completion referenced an unavailable relationship type"));
  }

  private record RelationshipKey(UUID sourceId, UUID targetId, UUID relationshipTypeId) {}

  private record MappingKey(
      UUID sourceId,
      URI conceptIri,
      ConceptMapping.ConceptMappingType mappingType,
      URI schemeIri) {}

  private record ValidatedMapping(MappingKey key, ConceptMapping mapping) {}
}
