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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.schema.api.data.OntologyInferenceExplanation;
import org.openmetadata.schema.api.data.OntologyInferenceExplanationRequest;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.RdfObjectKind;
import org.openmetadata.schema.type.RdfStatement;
import org.openmetadata.sdk.services.ontology.InferenceRuleService;

@Tag("rdf")
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
public class RdfInferenceMaterializationIT {
  private static final String INFERRED_GRAPH_BASE = "https://open-metadata.org/graph/inferred/";
  private static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";
  private static final String BELONGS_TO_GLOSSARY =
      "https://open-metadata.org/ontology/belongsToGlossary";
  private static final String TEST_RESOURCE_BASE = "urn:ontology-studio-test:";
  private static final String SOURCE_PREDICATE = TEST_RESOURCE_BASE + "source";
  private static final String INVALIDATION_PREDICATE = TEST_RESOURCE_BASE + "source-2";
  private static final String INFERRED_PREDICATE = TEST_RESOURCE_BASE + "inferred";
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final String RULES_PATH = "/v1/rdf/rules";
  private static final String VALIDATE_PATH = RULES_PATH + "/validate";
  private static final String MATERIALIZE_PATH = RULES_PATH + "/materialize";
  private static final String DATA_CONSUMER_EMAIL = "data-consumer@open-metadata.org";

  @BeforeAll
  static void ensureDataConsumerUser() {
    UserTestFactory.getDataConsumer(null);
  }

  @AfterEach
  void cleanup(final TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void validateAcceptsCanonicalConstructRule(final TestNamespace namespace) throws Exception {
    final ValidationOutcome outcome = validateRule(rule("valid-" + namespace.uniqueShortId()));

    assertTrue(outcome.valid(), () -> "expected valid rule, errors=" + outcome.errors());
    assertTrue(outcome.errors().isEmpty());
  }

  @Test
  void validateRejectsNonConstructQuery(final TestNamespace namespace) throws Exception {
    final ValidationOutcome outcome =
        validateRule(
            ruleWithBody(
                "select-" + namespace.uniqueShortId(), "SELECT ?subject WHERE { ?subject ?p ?o }"));

    assertFalse(outcome.valid());
    assertTrue(outcome.hasError("must be a SPARQL CONSTRUCT query"));
  }

  @Test
  void validateRejectsServiceClause(final TestNamespace namespace) throws Exception {
    final String body =
        "CONSTRUCT { ?s <urn:x:p> ?o } WHERE { SERVICE <urn:x:remote> { ?s <urn:x:src> ?o } }";
    final ValidationOutcome outcome =
        validateRule(ruleWithBody("svc-" + namespace.uniqueShortId(), body));

    assertFalse(outcome.valid());
    assertTrue(outcome.hasError("must not contain SERVICE clauses"));
  }

  @Test
  void validateRejectsDatasetClause(final TestNamespace namespace) throws Exception {
    final String body =
        "CONSTRUCT { ?s <urn:x:p> ?o } FROM <urn:x:graph> WHERE { ?s <urn:x:src> ?o }";
    final ValidationOutcome outcome =
        validateRule(ruleWithBody("ds-" + namespace.uniqueShortId(), body));

    assertFalse(outcome.valid());
    assertTrue(outcome.hasError("FROM or FROM NAMED dataset clauses"));
  }

  @Test
  void validateRejectsResultModifiers(final TestNamespace namespace) throws Exception {
    final String body =
        "CONSTRUCT { ?s <urn:x:p> ?o } WHERE { ?s <urn:x:src> ?o } ORDER BY ?s LIMIT 10";
    final ValidationOutcome outcome =
        validateRule(ruleWithBody("mod-" + namespace.uniqueShortId(), body));

    assertFalse(outcome.valid());
    assertTrue(outcome.hasError("LIMIT, OFFSET, or ORDER BY modifiers"));
  }

  @Test
  void upsertRejectsInvalidRuleBodyWith400(final TestNamespace namespace) throws Exception {
    final String name = "bad-" + namespace.uniqueShortId();
    final InferenceRule invalid =
        ruleWithBody(name, "SELECT ?subject WHERE { ?subject ?p ?o }");
    final HttpResponse<String> response =
        adminRequest("PUT", RULES_PATH + "/" + name, json(invalid));

    assertEquals(400, response.statusCode(), response.body());
  }

  @Test
  void deleteSystemRuleReturns400() throws Exception {
    final String systemRule = firstSystemRuleName();
    final HttpResponse<String> response =
        adminRequest("DELETE", RULES_PATH + "/" + systemRule, null);

    assertEquals(400, response.statusCode(), response.body());
  }

  @Test
  void getUnknownRuleReturns404(final TestNamespace namespace) throws Exception {
    final HttpResponse<String> response =
        adminRequest("GET", RULES_PATH + "/missing-" + namespace.uniqueShortId(), null);

    assertEquals(404, response.statusCode(), response.body());
  }

  @Test
  void getRuleAsNonAdminReturns403(final TestNamespace namespace) throws Exception {
    assertEquals(
        403, nonAdminRequest("GET", RULES_PATH + "/anything", null).statusCode());
  }

  @Test
  void upsertRuleAsNonAdminReturns403(final TestNamespace namespace) throws Exception {
    final String name = "denied-" + namespace.uniqueShortId();
    assertEquals(
        403, nonAdminRequest("PUT", RULES_PATH + "/" + name, json(rule(name))).statusCode());
  }

  @Test
  void deleteRuleAsNonAdminReturns403(final TestNamespace namespace) throws Exception {
    assertEquals(
        403,
        nonAdminRequest("DELETE", RULES_PATH + "/anything", null).statusCode());
  }

  @Test
  void validateRuleAsNonAdminReturns403(final TestNamespace namespace) throws Exception {
    final String name = "denied-" + namespace.uniqueShortId();
    assertEquals(403, nonAdminRequest("POST", VALIDATE_PATH, json(rule(name))).statusCode());
  }

  @Test
  void materializeRulesAsNonAdminReturns403(final TestNamespace namespace) throws Exception {
    assertEquals(403, nonAdminRequest("POST", MATERIALIZE_PATH, null).statusCode());
  }

  @Test
  void persistsInvalidatesMaterializesAndClearsCustomRules(final TestNamespace namespace)
      throws Exception {
    final String suffix = namespace.uniqueShortId();
    final String ruleName = "it-" + suffix;
    final MaterializationFixture fixture =
        new MaterializationFixture(
            ruleName,
            TEST_RESOURCE_BASE + "subject:" + suffix,
            TEST_RESOURCE_BASE + "object:" + suffix,
            INFERRED_GRAPH_BASE + ruleName);
    final InferenceRuleService service = SdkClients.adminClient().inferenceRules();
    final InferenceRule rule = rule(ruleName);

    service.upsert(ruleName, rule);
    try {
      verifyMaterializationLifecycle(service, fixture);
    } finally {
      cleanupRule(service, ruleName);
      deleteSourceTriples(fixture);
    }
  }

  @Test
  void explainsOnlyMaterializedStatementsInTheAuthorizedGlossary(final TestNamespace namespace)
      throws Exception {
    final Glossary glossary = GlossaryTestFactory.createSimple(namespace);
    final Glossary otherGlossary = GlossaryTestFactory.createWithName(namespace, "otherGlossary");
    final String suffix = namespace.uniqueShortId();
    final String ruleName = "explain-" + suffix;
    final String subject = TEST_RESOURCE_BASE + "concept:" + suffix;
    final String object = TEST_RESOURCE_BASE + "parent:" + suffix;
    final InferenceRuleService rules = SdkClients.adminClient().inferenceRules();
    rules.upsert(ruleName, rule(ruleName));
    try {
      insertScopedSource(glossary, subject, object);
      rules.materialize(true, ruleName);

      final OntologyInferenceExplanation explanation =
          SdkClients.adminClient()
              .ontologyReasoning()
              .explain(explanationRequest(glossary, subject, object));
      final OntologyInferenceExplanation isolated =
          SdkClients.adminClient()
              .ontologyReasoning()
              .explain(explanationRequest(otherGlossary, subject, object));

      assertTrue(explanation.getInferred());
      assertFalse(explanation.getAsserted());
      assertEquals(ruleName, explanation.getExplanations().getFirst().getRule().getName());
      assertFalse(isolated.getInferred());
      assertTrue(isolated.getExplanations().isEmpty());
    } finally {
      cleanupRule(rules, ruleName);
      deleteScopedSource(subject);
    }
  }

  private static InferenceRule rule(final String name) {
    return new InferenceRule()
        .withName(name)
        .withDisplayName("Integration test rule")
        .withEnabled(true)
        .withPriority(9000)
        .withRuleBody(
            "CONSTRUCT { ?subject <%s> ?object } WHERE { ?subject <%s> ?object }"
                .formatted(INFERRED_PREDICATE, SOURCE_PREDICATE));
  }

  private static void verifyMaterializationLifecycle(
      final InferenceRuleService service, final MaterializationFixture fixture) throws Exception {
    insertSourceTriple(fixture);
    assertSuccessfulMaterialization(service, fixture);
    insertInvalidatingTriple(fixture);
    assertTrue(service.get(fixture.ruleName()).getDirty());
    service.delete(fixture.ruleName());
    assertFalse(hasInferredTriple(fixture));
  }

  private static void assertSuccessfulMaterialization(
      final InferenceRuleService service, final MaterializationFixture fixture) {
    final InferenceRuleStatus dirty = service.get(fixture.ruleName());
    final InferenceMaterializationResult result = service.materialize(false, fixture.ruleName());
    final InferenceRuleStatus materialized = service.get(fixture.ruleName());

    assertTrue(dirty.getDirty());
    assertEquals(1, result.getSuccessfulRules());
    assertFalse(materialized.getDirty());
    assertEquals(1, materialized.getTripleCount());
    assertTrue(hasInferredTriple(fixture));
  }

  private static boolean hasInferredTriple(final MaterializationFixture fixture) {
    final String ask =
        "ASK { GRAPH <%s> { <%s> <%s> <%s> } }"
            .formatted(fixture.graphUri(), fixture.subject(), INFERRED_PREDICATE, fixture.object());
    return RdfTestUtils.executeSparqlAsk(ask);
  }

  private static void insertSourceTriple(final MaterializationFixture fixture) throws Exception {
    update(
        "INSERT DATA { <%s> <%s> <%s> }"
            .formatted(fixture.subject(), SOURCE_PREDICATE, fixture.object()));
  }

  private static void insertInvalidatingTriple(final MaterializationFixture fixture)
      throws Exception {
    update(
        "INSERT DATA { <%s> <%s> <%s> }"
            .formatted(fixture.subject(), INVALIDATION_PREDICATE, fixture.object()));
  }

  private static void deleteSourceTriples(final MaterializationFixture fixture) throws Exception {
    update("DELETE WHERE { <%s> ?predicate <%s> }".formatted(fixture.subject(), fixture.object()));
  }

  private static void insertScopedSource(
      final Glossary glossary, final String subject, final String object) throws Exception {
    final String glossaryUri = "https://open-metadata.org/entity/glossary/" + glossary.getId();
    update(
        "INSERT DATA { GRAPH <%s> { <%s> <%s> <%s> . <%s> <%s> <%s> . } }"
            .formatted(
                KNOWLEDGE_GRAPH,
                subject,
                SOURCE_PREDICATE,
                object,
                subject,
                BELONGS_TO_GLOSSARY,
                glossaryUri));
  }

  private static void deleteScopedSource(final String subject) throws Exception {
    update(
        "DELETE WHERE { GRAPH <%s> { <%s> ?predicate ?object } }"
            .formatted(KNOWLEDGE_GRAPH, subject));
  }

  private static OntologyInferenceExplanationRequest explanationRequest(
      final Glossary glossary, final String subject, final String object) {
    final RdfStatement statement =
        new RdfStatement()
            .withSubjectIri(URI.create(subject))
            .withPredicateIri(URI.create(INFERRED_PREDICATE))
            .withObjectKind(RdfObjectKind.IRI)
            .withObjectIri(URI.create(object));
    return new OntologyInferenceExplanationRequest()
        .withGlossaryId(glossary.getId())
        .withStatement(statement);
  }

  private static void cleanupRule(final InferenceRuleService service, final String ruleName) {
    final boolean exists =
        service.list().getRules().stream()
            .anyMatch(status -> ruleName.equals(status.getRule().getName()));
    if (exists) {
      service.delete(ruleName);
    }
  }

  private static void update(final String update) throws Exception {
    final String body = OBJECT_MAPPER.writeValueAsString(new SparqlQuery().withQuery(update));
    final HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/rdf/sparql/update"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
    final HttpResponse<String> response =
        HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), response.body());
  }

  private record MaterializationFixture(
      String ruleName, String subject, String object, String graphUri) {}
}
