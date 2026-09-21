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

package org.openmetadata.service.rdf.inference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.ServiceUnavailableException;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.schema.api.data.OntologyInferenceExplanation;
import org.openmetadata.schema.api.data.OntologyInferenceExplanationRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.RdfObjectKind;
import org.openmetadata.schema.type.RdfStatement;

class InferenceExplanationServiceTest {
  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String INFERRED_GRAPH = BASE_URI + "graph/inferred/hierarchy";
  private static final UUID GLOSSARY_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

  @Test
  void returnsTypedRuleExplanationsForScopedGraphMatches() {
    final AtomicReference<String> query = new AtomicReference<>();
    final InferenceExplanationService service = service(query, graphResponse(true, true), true);

    final OntologyInferenceExplanation result = service.explain(glossary(), request(statement()));

    assertTrue(result.getAsserted());
    assertTrue(result.getInferred());
    assertEquals(1, result.getExplanations().size());
    assertEquals("hierarchy", result.getExplanations().getFirst().getRule().getName());
    assertEquals(12, result.getExplanations().getFirst().getTripleCount().intValue());
    assertTrue(query.get().contains("belongsToGlossary"));
    assertEquals(2, query.get().split("belongsToGlossary", -1).length);
    assertTrue(query.get().contains(GLOSSARY_ID.toString()));
  }

  @Test
  void serializesTypedLiteralsWithoutSparqlInjection() {
    final AtomicReference<String> query = new AtomicReference<>();
    final InferenceExplanationService service = service(query, graphResponse(false, false), true);
    final RdfStatement literal =
        new RdfStatement()
            .withSubjectIri(URI.create("https://example.org/subject"))
            .withPredicateIri(URI.create("https://example.org/label"))
            .withObjectKind(RdfObjectKind.LITERAL)
            .withLiteralValue("label\" } UNION { ?s ?p ?o")
            .withLanguage("en");

    final OntologyInferenceExplanation result = service.explain(glossary(), request(literal));

    assertFalse(result.getAsserted());
    assertFalse(result.getInferred());
    assertTrue(result.getExplanations().isEmpty());
    assertTrue(query.get().contains("\\\" } UNION"));
    assertTrue(query.get().contains("@en"));
  }

  @Test
  void rejectsAmbiguousRdfObjectsAtTheTypedBoundary() {
    final InferenceExplanationService service =
        service(new AtomicReference<>(), graphResponse(false, false), true);
    final RdfStatement ambiguous = statement().withLiteralValue("not allowed for an IRI object");

    final IllegalArgumentException thrown =
        assertThrows(
            IllegalArgumentException.class, () -> service.explain(glossary(), request(ambiguous)));

    assertTrue(thrown.getMessage().contains("literalValue"));
  }

  @Test
  void failsExplicitlyWhenRdfIsDisabled() {
    final InferenceExplanationService service =
        service(new AtomicReference<>(), graphResponse(false, false), false);

    assertThrows(
        ServiceUnavailableException.class, () -> service.explain(glossary(), request(statement())));
  }

  @Test
  void rejectsGlossaryThatDoesNotMatchRequest() {
    final InferenceExplanationService service =
        service(new AtomicReference<>(), graphResponse(false, false), true);
    final Glossary mismatched =
        new Glossary()
            .withId(UUID.fromString("22222222-2222-2222-2222-222222222222"))
            .withName("other")
            .withFullyQualifiedName("other");

    final IllegalArgumentException thrown =
        assertThrows(
            IllegalArgumentException.class,
            () -> service.explain(mismatched, request(statement())));

    assertTrue(thrown.getMessage().contains("does not match request"));
  }

  @Test
  void rejectsStatementWithNullSubjectIri() {
    final InferenceExplanationService service =
        service(new AtomicReference<>(), graphResponse(false, false), true);
    final RdfStatement statement =
        new RdfStatement()
            .withPredicateIri(URI.create("https://example.org/label"))
            .withObjectKind(RdfObjectKind.IRI)
            .withObjectIri(URI.create("https://example.org/parent"));

    final NullPointerException thrown =
        assertThrows(
            NullPointerException.class, () -> service.explain(glossary(), request(statement)));

    assertTrue(thrown.getMessage().contains("subject IRI"));
  }

  @Test
  void rejectsStatementWithNullPredicateIri() {
    final InferenceExplanationService service =
        service(new AtomicReference<>(), graphResponse(false, false), true);
    final RdfStatement statement =
        new RdfStatement()
            .withSubjectIri(URI.create("https://example.org/child"))
            .withObjectKind(RdfObjectKind.IRI)
            .withObjectIri(URI.create("https://example.org/parent"));

    final NullPointerException thrown =
        assertThrows(
            NullPointerException.class, () -> service.explain(glossary(), request(statement)));

    assertTrue(thrown.getMessage().contains("predicate IRI"));
  }

  @Test
  void rejectsStatementWithNullObjectKind() {
    final InferenceExplanationService service =
        service(new AtomicReference<>(), graphResponse(false, false), true);
    final RdfStatement statement =
        new RdfStatement()
            .withSubjectIri(URI.create("https://example.org/child"))
            .withPredicateIri(URI.create("https://example.org/label"));

    final NullPointerException thrown =
        assertThrows(
            NullPointerException.class, () -> service.explain(glossary(), request(statement)));

    assertTrue(thrown.getMessage().contains("object kind"));
  }

  @Test
  void rejectsLiteralObjectMissingLiteralValue() {
    final InferenceExplanationService service =
        service(new AtomicReference<>(), graphResponse(false, false), true);
    final RdfStatement statement =
        new RdfStatement()
            .withSubjectIri(URI.create("https://example.org/subject"))
            .withPredicateIri(URI.create("https://example.org/label"))
            .withObjectKind(RdfObjectKind.LITERAL);

    final IllegalArgumentException thrown =
        assertThrows(
            IllegalArgumentException.class, () -> service.explain(glossary(), request(statement)));

    assertTrue(thrown.getMessage().contains("requires literalValue"));
  }

  @Test
  void rejectsLiteralDefiningBothDatatypeAndLanguage() {
    final InferenceExplanationService service =
        service(new AtomicReference<>(), graphResponse(false, false), true);
    final RdfStatement statement =
        new RdfStatement()
            .withSubjectIri(URI.create("https://example.org/subject"))
            .withPredicateIri(URI.create("https://example.org/label"))
            .withObjectKind(RdfObjectKind.LITERAL)
            .withLiteralValue("value")
            .withDatatypeIri(URI.create("http://www.w3.org/2001/XMLSchema#string"))
            .withLanguage("en");

    final IllegalArgumentException thrown =
        assertThrows(
            IllegalArgumentException.class, () -> service.explain(glossary(), request(statement)));

    assertTrue(thrown.getMessage().contains("both datatypeIri and language"));
  }

  @Test
  void serializesTypedLiteralWithDatatypeIri() {
    final AtomicReference<String> query = new AtomicReference<>();
    final InferenceExplanationService service = service(query, graphResponse(false, false), true);
    final RdfStatement statement =
        new RdfStatement()
            .withSubjectIri(URI.create("https://example.org/subject"))
            .withPredicateIri(URI.create("https://example.org/count"))
            .withObjectKind(RdfObjectKind.LITERAL)
            .withLiteralValue("42")
            .withDatatypeIri(URI.create("http://www.w3.org/2001/XMLSchema#integer"));

    service.explain(glossary(), request(statement));

    assertTrue(query.get().contains("^^"));
    assertTrue(query.get().contains("XMLSchema#integer"));
    assertFalse(query.get().contains("@en"));
  }

  private static InferenceExplanationService service(
      final AtomicReference<String> query, final String response, final boolean isAvailable) {
    final InferenceExplanationService.QueryExecutor executor =
        new InferenceExplanationService.QueryExecutor() {
          @Override
          public String execute(final String sparql, final String format) {
            query.set(sparql);
            return response;
          }

          @Override
          public boolean isAvailable() {
            return isAvailable;
          }
        };
    return new InferenceExplanationService(executor, () -> List.of(ruleStatus()), BASE_URI);
  }

  private static InferenceRuleStatus ruleStatus() {
    final InferenceRule rule =
        new InferenceRule()
            .withName("hierarchy")
            .withDisplayName("Hierarchy inference")
            .withDescription("Infers the hierarchy")
            .withRuleBody("CONSTRUCT { ?child ?p ?parent } WHERE { ?child ?p ?parent }");
    return new InferenceRuleStatus()
        .withRule(rule)
        .withGraphUri(URI.create(INFERRED_GRAPH))
        .withDirty(false)
        .withSystemRule(true)
        .withTripleCount(12);
  }

  private static OntologyInferenceExplanationRequest request(final RdfStatement statement) {
    return new OntologyInferenceExplanationRequest()
        .withGlossaryId(GLOSSARY_ID)
        .withStatement(statement);
  }

  private static RdfStatement statement() {
    return new RdfStatement()
        .withSubjectIri(URI.create("https://example.org/child"))
        .withPredicateIri(URI.create("http://www.w3.org/2000/01/rdf-schema#subClassOf"))
        .withObjectKind(RdfObjectKind.IRI)
        .withObjectIri(URI.create("https://example.org/parent"));
  }

  private static Glossary glossary() {
    return new Glossary()
        .withId(GLOSSARY_ID)
        .withName("governed")
        .withFullyQualifiedName("governed");
  }

  private static String graphResponse(final boolean asserted, final boolean inferred) {
    final String assertedBinding =
        asserted ? binding(InferenceExplanationService.KNOWLEDGE_GRAPH) : "";
    final String separator = asserted && inferred ? "," : "";
    final String inferredBinding = inferred ? binding(INFERRED_GRAPH) : "";
    return """
        {"head":{"vars":["graph"]},"results":{"bindings":[%s%s%s]}}
        """
        .formatted(assertedBinding, separator, inferredBinding);
  }

  private static String binding(final String graphUri) {
    return """
        {"graph":{"type":"uri","value":"%s"}}
        """.formatted(graphUri).trim();
  }
}
