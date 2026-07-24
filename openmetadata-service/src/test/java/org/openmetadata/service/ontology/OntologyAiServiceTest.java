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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.NotFoundException;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.OntologyDomainDraftRequest;
import org.openmetadata.schema.api.data.OntologyMappingSuggestionList;
import org.openmetadata.schema.api.data.OntologyMappingSuggestionRequest;
import org.openmetadata.schema.api.data.OntologyNaturalLanguageQueryRequest;
import org.openmetadata.schema.api.data.OntologyNaturalLanguageQueryResult;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestionList;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestionRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.service.exception.OntologyAiProviderException;
import org.openmetadata.service.rdf.OntologySparqlQueryValidator;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;

class OntologyAiServiceTest {
  private static final String GLOSSARY_FQN = "healthcare";
  private static final long GENERATED_AT = 1_784_409_600_000L;
  private static final Clock CLOCK =
      Clock.fixed(Instant.ofEpochMilli(GENERATED_AT), ZoneOffset.UTC);
  private Glossary glossary;
  private GlossaryTerm source;
  private GlossaryTerm target;
  private RelationshipType relationshipType;
  private StubGateway gateway;
  private OntologyAiService service;

  @BeforeEach
  void setUp() {
    glossary = glossary(GLOSSARY_FQN, false);
    source = term("provider", glossary, 1.2D);
    target = term("facility", glossary, 2.1D);
    relationshipType = relationshipType();
    gateway = new StubGateway();
    service = service(true, new TestCatalog(glossary, List.of(source, target), relationshipType));
  }

  @Test
  void disabledCapabilityPreventsEveryProviderCall() {
    final OntologyAiService disabled =
        service(false, new TestCatalog(glossary, List.of(source, target), relationshipType));

    assertThrows(NotFoundException.class, () -> disabled.suggestRelationships(null));
    assertThrows(NotFoundException.class, () -> disabled.suggestMappings(null));
    assertThrows(NotFoundException.class, () -> disabled.generateSparql(null));
    assertThrows(NotFoundException.class, () -> disabled.generateDomainDraft(null));
    assertEquals(0, gateway.invocationCount);
  }

  @Test
  void createsTypedRelationshipProposalWithoutMutatingTerms() {
    gateway.relationshipCompletion =
        completion(
            new OntologyAiCompletionGateway.RelationshipCandidate(
                source.getId(), target.getId(), relationshipType.getId(), 0.93D, "Strong fit"));

    final OntologyRelationshipSuggestionList result =
        service.suggestRelationships(relationshipRequest());
    final var suggestion = result.getSuggestions().getFirst();
    final var operation = suggestion.getOperation();
    final var relationship = operation.getRelationship();

    assertEquals("test-model", result.getModelId());
    assertEquals(GENERATED_AT, result.getGeneratedAt());
    assertEquals(OntologyChangeOperationType.ADD_RELATIONSHIP, operation.getOperationType());
    assertEquals(source.getId(), operation.getTargetId());
    assertEquals(source.getVersion(), operation.getBaseVersion());
    assertEquals(source.getId(), relationship.getFromTerm().getId());
    assertEquals(target.getId(), relationship.getToTerm().getId());
    assertEquals(relationshipType.getId(), relationship.getRelationshipType().getId());
    assertEquals(RelationProvenance.AI_SUGGESTED, relationship.getProvenance());
    assertEquals(EntityStatus.DRAFT, relationship.getStatus());
    assertEquals("ask-collate", relationship.getCreatedBy());
    assertEquals(GENERATED_AT, relationship.getCreatedAt());
    assertEquals(0.93D, suggestion.getConfidence());
  }

  @Test
  void rejectsRelationshipIdentifiersNotPresentInPrompt() {
    gateway.relationshipCompletion =
        completion(
            new OntologyAiCompletionGateway.RelationshipCandidate(
                UUID.randomUUID(),
                target.getId(),
                relationshipType.getId(),
                0.7D,
                "Invented source"));

    assertThrows(
        OntologyAiProviderException.class,
        () -> service.suggestRelationships(relationshipRequest()));
  }

  @Test
  void deduplicatesAndCapsRelationshipProposals() {
    final OntologyAiCompletionGateway.RelationshipCandidate duplicate =
        new OntologyAiCompletionGateway.RelationshipCandidate(
            source.getId(), target.getId(), relationshipType.getId(), 0.9D, "Duplicate");
    gateway.relationshipCompletion =
        new OntologyAiCompletionGateway.Completion<>("test-model", List.of(duplicate, duplicate));
    final OntologyRelationshipSuggestionRequest request =
        relationshipRequest().withMaxSuggestions(1);

    final OntologyRelationshipSuggestionList result = service.suggestRelationships(request);

    assertEquals(1, result.getSuggestions().size());
  }

  @Test
  void createsTypedStandardsMappingProposal() {
    gateway.mappingCompletion =
        completion(
            new OntologyAiCompletionGateway.MappingCandidate(
                source.getId(),
                "https://hl7.org/fhir/Practitioner",
                "EXACT_MATCH",
                "https://hl7.org/fhir",
                "FHIR",
                "Practitioner",
                0.88D,
                "Equivalent clinical concept"));

    final OntologyMappingSuggestionList result = service.suggestMappings(mappingRequest());
    final var suggestion = result.getSuggestions().getFirst();
    final var operation = suggestion.getOperation();
    final ConceptMapping mapping = operation.getMapping();

    assertEquals(OntologyChangeOperationType.UPSERT_MAPPING, operation.getOperationType());
    assertEquals(source.getId(), operation.getTargetId());
    assertEquals(URI.create("https://hl7.org/fhir/Practitioner"), mapping.getConceptIri());
    assertEquals(ConceptMapping.ConceptMappingType.EXACT_MATCH, mapping.getMappingType());
    assertEquals(URI.create("https://hl7.org/fhir"), mapping.getSchemeIri());
    assertEquals("FHIR", mapping.getSource());
    assertEquals("Practitioner", suggestion.getTargetLabel());
  }

  @Test
  void rejectsRelativeMappingIriAndUnsupportedMappingType() {
    gateway.mappingCompletion = mappingCompletion("relative/concept", "EXACT_MATCH");
    assertThrows(
        OntologyAiProviderException.class, () -> service.suggestMappings(mappingRequest()));

    gateway.mappingCompletion = mappingCompletion("https://example.com/concept", "OTHER");
    assertThrows(
        OntologyAiProviderException.class, () -> service.suggestMappings(mappingRequest()));
  }

  @Test
  void exposesGeneratedReadOnlySparqlForReview() {
    final String query = "SELECT ?concept WHERE { ?concept a <https://example.com/Concept> }";
    gateway.sparqlCompletion =
        completion(new OntologyAiCompletionGateway.SparqlCandidate(query, "Lists concepts"));

    final OntologyNaturalLanguageQueryResult result =
        service.generateSparql(naturalLanguageRequest());

    assertEquals(query, result.getQuery());
    assertEquals("Lists concepts", result.getExplanation());
    assertEquals("test-model", result.getModelId());
    assertEquals(GENERATED_AT, result.getGeneratedAt());
  }

  @Test
  void rejectsUnsafeOrAmbiguousGeneratedSparql() {
    assertUnsafeQuery("SELECT * FROM <https://outside.example/graph> WHERE { ?s ?p ?o }");
    assertUnsafeQuery("SELECT * WHERE { SERVICE <https://outside.example/sparql> { ?s ?p ?o } }");
    assertUnsafeQuery("DELETE WHERE { ?s ?p ?o }");
    gateway.sparqlCompletion =
        new OntologyAiCompletionGateway.Completion<>(
            "test-model",
            List.of(
                new OntologyAiCompletionGateway.SparqlCandidate("ASK { ?s ?p ?o }", "One"),
                new OntologyAiCompletionGateway.SparqlCandidate("ASK { ?s ?p ?o }", "Two")));

    assertThrows(
        OntologyAiProviderException.class, () -> service.generateSparql(naturalLanguageRequest()));
  }

  @Test
  void createsParentFirstDomainDraftThroughTypedChangeOperations() {
    gateway.domainCompletion =
        new OntologyAiCompletionGateway.Completion<>(
            "test-model",
            List.of(
                new OntologyAiCompletionGateway.DomainConceptCandidate(
                    "clinical", "Clinical", "Clinical concepts", null),
                new OntologyAiCompletionGateway.DomainConceptCandidate(
                    "diagnosis", "Diagnosis", "Diagnosis concept", "clinical")));

    final var result = service.generateDomainDraft(domainRequest());
    final var operations = result.getDraft().getOperations();
    final var parent = operations.getFirst().getTerm();
    final var child = operations.getLast().getTerm();

    assertEquals(2, operations.size());
    assertEquals(2, result.getDraft().getUndoCursor());
    assertEquals(Set.of(GLOSSARY_FQN), result.getDraft().getGlossaries());
    assertEquals(OntologyChangeOperationType.CREATE_TERM, operations.getFirst().getOperationType());
    assertNull(parent.getParent());
    assertEquals(parent.getId(), child.getParent().getId());
    assertEquals("healthcare.clinical.diagnosis", child.getFullyQualifiedName());
    assertEquals(EntityStatus.DRAFT, child.getEntityStatus());
  }

  @Test
  void rejectsDomainParentThatWasNotCreatedEarlier() {
    gateway.domainCompletion =
        completion(
            new OntologyAiCompletionGateway.DomainConceptCandidate(
                "child", "Child", "Child concept", "missing"));

    assertThrows(
        OntologyAiProviderException.class, () -> service.generateDomainDraft(domainRequest()));
  }

  @Test
  void rejectsCrossGlossaryTermsAndReadOnlyOntologiesBeforeCompletion() {
    final Glossary otherGlossary = glossary("other", false);
    final GlossaryTerm otherTerm = term("otherTerm", otherGlossary, 0.1D);
    service =
        service(
            true, new TestCatalog(glossary, List.of(source, target, otherTerm), relationshipType));
    final OntologyRelationshipSuggestionRequest request =
        relationshipRequest().withCandidateTermIds(Set.of(otherTerm.getId()));
    assertThrows(IllegalArgumentException.class, () -> service.suggestRelationships(request));

    final Glossary readOnly = glossary(GLOSSARY_FQN, true);
    service = service(true, new TestCatalog(readOnly, List.of(source, target), relationshipType));
    assertThrows(IllegalArgumentException.class, () -> service.suggestMappings(mappingRequest()));
    assertEquals(0, gateway.invocationCount);
  }

  private OntologyAiService service(final boolean enabled, final OntologyAiCatalog catalog) {
    return new OntologyAiService(
        enabled,
        gateway,
        catalog,
        new OntologySparqlQueryValidator(new SparqlFederationGuard(null)),
        CLOCK);
  }

  private OntologyRelationshipSuggestionRequest relationshipRequest() {
    return new OntologyRelationshipSuggestionRequest()
        .withGlossary(GLOSSARY_FQN)
        .withSourceTermIds(Set.of(source.getId()))
        .withCandidateTermIds(Set.of(target.getId()))
        .withRelationshipTypeIds(Set.of(relationshipType.getId()))
        .withMaxSuggestions(10);
  }

  private OntologyMappingSuggestionRequest mappingRequest() {
    return new OntologyMappingSuggestionRequest()
        .withGlossary(GLOSSARY_FQN)
        .withSourceTermIds(Set.of(source.getId()))
        .withStandards(Set.of("FHIR"))
        .withMaxSuggestions(10);
  }

  private static OntologyNaturalLanguageQueryRequest naturalLanguageRequest() {
    return new OntologyNaturalLanguageQueryRequest()
        .withGlossaries(Set.of(GLOSSARY_FQN))
        .withQuestion("Which concepts are defined?");
  }

  private static OntologyDomainDraftRequest domainRequest() {
    return new OntologyDomainDraftRequest()
        .withGlossary(GLOSSARY_FQN)
        .withChangeSetName("generated-domain")
        .withDisplayName("Generated domain")
        .withDescription("Review this generated domain")
        .withDomainDescription("Healthcare concepts and their hierarchy")
        .withMaxConcepts(10);
  }

  private OntologyAiCompletionGateway.Completion<OntologyAiCompletionGateway.MappingCandidate>
      mappingCompletion(final String conceptIri, final String mappingType) {
    return completion(
        new OntologyAiCompletionGateway.MappingCandidate(
            source.getId(),
            conceptIri,
            mappingType,
            null,
            "FHIR",
            "Target",
            0.7D,
            "Candidate mapping"));
  }

  private void assertUnsafeQuery(final String query) {
    gateway.sparqlCompletion =
        completion(new OntologyAiCompletionGateway.SparqlCandidate(query, "Unsafe"));
    assertThrows(
        OntologyAiProviderException.class, () -> service.generateSparql(naturalLanguageRequest()));
  }

  private static Glossary glossary(final String name, final boolean readOnly) {
    return new Glossary()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withDescription("Test glossary")
        .withOntologyConfiguration(new OntologyConfiguration().withReadOnly(readOnly));
  }

  private static GlossaryTerm term(
      final String name, final Glossary glossary, final double version) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName(name)
        .withDisplayName(name)
        .withDescription(name + " description")
        .withFullyQualifiedName(glossary.getFullyQualifiedName() + "." + name)
        .withGlossary(glossary.getEntityReference())
        .withVersion(version);
  }

  private static RelationshipType relationshipType() {
    return new RelationshipType()
        .withId(UUID.randomUUID())
        .withName("relatedClinicalConcept")
        .withDisplayName("Related clinical concept")
        .withFullyQualifiedName("relatedClinicalConcept")
        .withDescription("Relates clinical concepts")
        .withRdfPredicate(URI.create("https://example.com/relatedClinicalConcept"))
        .withCategory(RelationshipTypeCategory.CUSTOM)
        .withDomain(Set.of())
        .withRange(Set.of());
  }

  private static <T> OntologyAiCompletionGateway.Completion<T> completion(final T item) {
    return new OntologyAiCompletionGateway.Completion<>("test-model", List.of(item));
  }

  private record TestCatalog(
      Glossary configuredGlossary,
      List<GlossaryTerm> terms,
      RelationshipType configuredRelationshipType)
      implements OntologyAiCatalog {
    @Override
    public Glossary glossary(final String fullyQualifiedName) {
      assertEquals(configuredGlossary.getFullyQualifiedName(), fullyQualifiedName);
      return configuredGlossary;
    }

    @Override
    public GlossaryTerm term(final UUID id) {
      return terms.stream().filter(term -> term.getId().equals(id)).findFirst().orElseThrow();
    }

    @Override
    public RelationshipType relationshipType(final UUID id) {
      assertEquals(configuredRelationshipType.getId(), id);
      return configuredRelationshipType;
    }
  }

  private static final class StubGateway implements OntologyAiCompletionGateway {
    private int invocationCount;
    private Completion<RelationshipCandidate> relationshipCompletion;
    private Completion<MappingCandidate> mappingCompletion;
    private Completion<SparqlCandidate> sparqlCompletion;
    private Completion<DomainConceptCandidate> domainCompletion;

    @Override
    public Completion<RelationshipCandidate> suggestRelationships(final RelationshipPrompt prompt) {
      invocationCount++;
      assertNotNull(prompt);
      return relationshipCompletion;
    }

    @Override
    public Completion<MappingCandidate> suggestMappings(final MappingPrompt prompt) {
      invocationCount++;
      assertNotNull(prompt);
      return mappingCompletion;
    }

    @Override
    public Completion<SparqlCandidate> generateSparql(final NaturalLanguagePrompt prompt) {
      invocationCount++;
      assertTrue(prompt.glossaries().contains(GLOSSARY_FQN));
      return sparqlCompletion;
    }

    @Override
    public Completion<DomainConceptCandidate> generateDomainDraft(final DomainPrompt prompt) {
      invocationCount++;
      assertEquals(GLOSSARY_FQN, prompt.glossary());
      return domainCompletion;
    }
  }
}
