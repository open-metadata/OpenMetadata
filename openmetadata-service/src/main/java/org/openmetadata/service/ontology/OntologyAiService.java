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

import static org.openmetadata.service.ontology.OntologyAiOutputValidator.invalid;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.modelId;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.requireCompletion;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.requireText;

import jakarta.ws.rs.NotFoundException;
import java.time.Clock;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.OntologyDomainDraftRequest;
import org.openmetadata.schema.api.data.OntologyDomainDraftResult;
import org.openmetadata.schema.api.data.OntologyMappingSuggestion;
import org.openmetadata.schema.api.data.OntologyMappingSuggestionList;
import org.openmetadata.schema.api.data.OntologyMappingSuggestionRequest;
import org.openmetadata.schema.api.data.OntologyNaturalLanguageQueryRequest;
import org.openmetadata.schema.api.data.OntologyNaturalLanguageQueryResult;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestion;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestionList;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestionRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.service.exception.OntologyAiProviderException;
import org.openmetadata.service.monitoring.OntologyMetrics;
import org.openmetadata.service.rdf.OntologySparqlQueryValidator;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard.FederationDisallowedException;

/** Converts optional AI completions into reviewable, typed Ontology Studio proposals. */
public final class OntologyAiService {
  private final boolean enabled;
  private final OntologyAiCompletionGateway gateway;
  private final OntologyAiCatalog catalog;
  private final OntologySparqlQueryValidator sparqlValidator;
  private final Clock clock;
  private final OntologyAiProposalFactory proposalFactory;
  private final OntologyAiDomainDraftFactory domainDraftFactory;

  public OntologyAiService(
      final boolean enabled,
      final OntologyAiCompletionGateway gateway,
      final OntologyAiCatalog catalog,
      final OntologySparqlQueryValidator sparqlValidator,
      final Clock clock) {
    this.enabled = enabled;
    this.gateway = Objects.requireNonNull(gateway);
    this.catalog = Objects.requireNonNull(catalog);
    this.sparqlValidator = Objects.requireNonNull(sparqlValidator);
    this.clock = Objects.requireNonNull(clock);
    this.proposalFactory = new OntologyAiProposalFactory(clock);
    this.domainDraftFactory = new OntologyAiDomainDraftFactory();
  }

  public void requireAvailable() {
    if (!enabled) {
      OntologyMetrics.recordAiDisabled();
      throw new NotFoundException("Ontology AI is disabled");
    }
  }

  public OntologyRelationshipSuggestionList suggestRelationships(
      final OntologyRelationshipSuggestionRequest request) {
    return withMetrics(() -> suggestRelationshipsInternal(request));
  }

  private OntologyRelationshipSuggestionList suggestRelationshipsInternal(
      final OntologyRelationshipSuggestionRequest request) {
    requireAvailable();
    final Glossary glossary = editableGlossary(request.getGlossary());
    final List<GlossaryTerm> sources = terms(request.getSourceTermIds(), glossary);
    final List<GlossaryTerm> candidates = terms(request.getCandidateTermIds(), glossary);
    final List<RelationshipType> types = relationshipTypes(request.getRelationshipTypeIds());
    final OntologyAiCompletionGateway.RelationshipPrompt prompt =
        proposalFactory.relationshipPrompt(request, sources, candidates, types);
    final OntologyAiCompletionGateway.Completion<OntologyAiCompletionGateway.RelationshipCandidate>
        completion = gateway.suggestRelationships(prompt);
    final List<OntologyRelationshipSuggestion> suggestions =
        proposalFactory.relationships(completion, request, sources, candidates, types);
    return new OntologyRelationshipSuggestionList()
        .withModelId(modelId(completion))
        .withGeneratedAt(clock.millis())
        .withSuggestions(suggestions);
  }

  public OntologyMappingSuggestionList suggestMappings(
      final OntologyMappingSuggestionRequest request) {
    return withMetrics(() -> suggestMappingsInternal(request));
  }

  private OntologyMappingSuggestionList suggestMappingsInternal(
      final OntologyMappingSuggestionRequest request) {
    requireAvailable();
    final Glossary glossary = editableGlossary(request.getGlossary());
    final List<GlossaryTerm> sources = terms(request.getSourceTermIds(), glossary);
    final OntologyAiCompletionGateway.MappingPrompt prompt =
        proposalFactory.mappingPrompt(request, sources);
    final OntologyAiCompletionGateway.Completion<OntologyAiCompletionGateway.MappingCandidate>
        completion = gateway.suggestMappings(prompt);
    final List<OntologyMappingSuggestion> suggestions =
        proposalFactory.mappings(completion, request, sources);
    return new OntologyMappingSuggestionList()
        .withModelId(modelId(completion))
        .withGeneratedAt(clock.millis())
        .withSuggestions(suggestions);
  }

  public OntologyNaturalLanguageQueryResult generateSparql(
      final OntologyNaturalLanguageQueryRequest request) {
    return withMetrics(() -> generateSparqlInternal(request));
  }

  private OntologyNaturalLanguageQueryResult generateSparqlInternal(
      final OntologyNaturalLanguageQueryRequest request) {
    requireAvailable();
    request.getGlossaries().forEach(catalog::glossary);
    final OntologyAiCompletionGateway.NaturalLanguagePrompt prompt =
        new OntologyAiCompletionGateway.NaturalLanguagePrompt(
            List.copyOf(request.getGlossaries()), request.getQuestion());
    final OntologyAiCompletionGateway.Completion<OntologyAiCompletionGateway.SparqlCandidate>
        completion = gateway.generateSparql(prompt);
    final OntologyAiCompletionGateway.SparqlCandidate candidate = sparqlCandidate(completion);
    validateGeneratedSparql(candidate.query());
    requireText(candidate.explanation(), "SPARQL explanation");
    return new OntologyNaturalLanguageQueryResult()
        .withModelId(modelId(completion))
        .withGeneratedAt(clock.millis())
        .withQuery(candidate.query())
        .withExplanation(candidate.explanation());
  }

  public OntologyDomainDraftResult generateDomainDraft(final OntologyDomainDraftRequest request) {
    return withMetrics(() -> generateDomainDraftInternal(request));
  }

  private OntologyDomainDraftResult generateDomainDraftInternal(
      final OntologyDomainDraftRequest request) {
    requireAvailable();
    final Glossary glossary = editableGlossary(request.getGlossary());
    final OntologyAiCompletionGateway.DomainPrompt prompt =
        new OntologyAiCompletionGateway.DomainPrompt(
            glossary.getFullyQualifiedName(),
            request.getDomainDescription(),
            request.getMaxConcepts());
    final OntologyAiCompletionGateway.Completion<OntologyAiCompletionGateway.DomainConceptCandidate>
        completion = gateway.generateDomainDraft(prompt);
    final CreateOntologyChangeSet draft = domainDraftFactory.create(request, glossary, completion);
    return new OntologyDomainDraftResult()
        .withModelId(modelId(completion))
        .withGeneratedAt(clock.millis())
        .withDraft(draft);
  }

  private static <T> T withMetrics(final Supplier<T> operation) {
    final T result;
    try {
      result = operation.get();
      OntologyMetrics.recordAiRequest(true);
    } catch (RuntimeException exception) {
      OntologyMetrics.recordAiRequest(false);
      throw exception;
    }
    return result;
  }

  private Glossary editableGlossary(final String fullyQualifiedName) {
    final Glossary glossary = catalog.glossary(fullyQualifiedName);
    if (glossary.getOntologyConfiguration() != null
        && Boolean.TRUE.equals(glossary.getOntologyConfiguration().getReadOnly())) {
      throw new IllegalArgumentException(
          "Glossary '%s' is read-only".formatted(glossary.getFullyQualifiedName()));
    }
    return glossary;
  }

  private List<GlossaryTerm> terms(final Set<UUID> termIds, final Glossary glossary) {
    final List<GlossaryTerm> terms = termIds.stream().map(catalog::term).toList();
    terms.forEach(term -> requireGlossary(term, glossary));
    return terms;
  }

  private static void requireGlossary(final GlossaryTerm term, final Glossary glossary) {
    final String actualGlossary = term.getGlossary().getFullyQualifiedName();
    if (!Objects.equals(actualGlossary, glossary.getFullyQualifiedName())) {
      throw new IllegalArgumentException(
          "Term '%s' does not belong to glossary '%s'"
              .formatted(term.getFullyQualifiedName(), glossary.getFullyQualifiedName()));
    }
  }

  private List<RelationshipType> relationshipTypes(final Set<UUID> typeIds) {
    return typeIds.stream().map(catalog::relationshipType).toList();
  }

  private static OntologyAiCompletionGateway.SparqlCandidate sparqlCandidate(
      final OntologyAiCompletionGateway.Completion<OntologyAiCompletionGateway.SparqlCandidate>
          completion) {
    requireCompletion(completion);
    if (completion.items().size() != 1) {
      throw invalid("SPARQL completion must contain exactly one candidate");
    }
    return completion.items().getFirst();
  }

  private void validateGeneratedSparql(final String query) {
    try {
      sparqlValidator.validate(query);
    } catch (IllegalArgumentException | FederationDisallowedException exception) {
      throw new OntologyAiProviderException(
          "Ontology AI provider returned unsafe SPARQL: " + exception.getMessage(), exception);
    }
  }
}
