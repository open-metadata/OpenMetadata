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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Predicate;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.rdf.RdfOntologyCandidate;
import org.openmetadata.schema.api.rdf.RdfOntologyCandidateOutcome;
import org.openmetadata.schema.api.rdf.RdfOntologyClosure;
import org.openmetadata.schema.api.rdf.RdfOntologyClosureProblemCode;
import org.openmetadata.schema.api.rdf.RdfOntologyExclusion;
import org.openmetadata.schema.api.rdf.RdfOntologyExclusionReason;
import org.openmetadata.schema.api.rdf.RdfOntologyReasoningStatus;
import org.openmetadata.schema.api.rdf.RdfOntologySelection;
import org.openmetadata.schema.api.rdf.RdfReasoningOperation;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLayer;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Production reasoning reads Approved axioms and terms only. Through the REST API and against
 * Fuseki: a Draft axiom stays out of a glossary's closure until it is approved, the closure digest
 * moves with member content and nothing else, activation publishes a manifest that pins every
 * member, and a candidate closure takes in a Draft axiom without touching production.
 */
@Tag("rdf")
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
public class RdfOntologyActivationIT {
  private static final String REASONING = "/v1/ontology/reasoning";
  private static final String OMR = "https://open-metadata.org/reasoning/";
  private static final Duration PROJECTION_WAIT = Duration.ofSeconds(90);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(1);
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  @AfterEach
  void cleanup(final TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void aDraftAxiomJoinsTheClosureOnlyOnceApproved(final TestNamespace namespace) {
    final String ex = "https://example.org/" + namespace.prefix("activation") + "/";
    final Glossary glossary = createGlossary(namespace, "activation");
    createTerm(glossary, "Customer");
    final CreateOntologyAxiom request =
        axiomRequest(
            glossary, "activationContactable", ex + "ContactableCustomer", named(ex + "Customer"));
    final OntologyAxiom axiom = SdkClients.adminClient().ontologyAxioms().create(request);

    final RdfOntologyClosure draft =
        awaitClosure(
            glossary,
            closure ->
                closure.getIncluded().getTerms() == 1
                    && closure
                        .getExcluded()
                        .contains(exclusion(RdfOntologyExclusionReason.DRAFT, 1)));
    assertEquals(0L, draft.getIncluded().getAxioms(), "a Draft axiom is not in the closure");
    assertEquals(RdfOntologySelection.APPROVED, draft.getSelection());

    SdkClients.adminClient()
        .ontologyAxioms()
        .upsert(request.withEntityStatus(EntityStatus.APPROVED));
    final RdfOntologyClosure approved =
        awaitClosure(glossary, closure -> closure.getIncluded().getAxioms() == 1);
    assertTrue(approved.getExcluded().isEmpty());
    assertNotEquals(draft.getClosureDigest(), approved.getClosureDigest());

    SdkClients.adminClient()
        .ontologyAxioms()
        .upsert(request.withDescription("Reworded; the axiom's triples are unchanged"));
    awaitAsk(
        "ASK { <https://open-metadata.org/entity/ontologyAxiom/%s> ?p ?description "
                .formatted(axiom.getId())
            + "FILTER(CONTAINS(STR(?description), \"Reworded\")) }");
    assertEquals(
        approved.getClosureDigest(),
        closure(glossary).getClosureDigest(),
        "rewriting a member with the same triples keeps the digest");

    SdkClients.adminClient()
        .ontologyAxioms()
        .upsert(request.withExpressions(List.of(named(ex + "Party"))));
    final RdfOntologyClosure edited =
        awaitClosure(
            glossary, closure -> !closure.getClosureDigest().equals(approved.getClosureDigest()));
    assertEquals(1L, edited.getIncluded().getAxioms());
  }

  @Test
  void activationPinsMembersAndACandidateLeavesProductionAlone(final TestNamespace namespace) {
    final String ex = "https://example.org/" + namespace.prefix("candidate") + "/";
    final Glossary glossary = createGlossary(namespace, "candidate");
    createTerm(glossary, "Customer");
    final OntologyAxiom approved =
        SdkClients.adminClient()
            .ontologyAxioms()
            .create(
                axiomRequest(
                        glossary, "candidateApproved", ex + "Contactable", named(ex + "Customer"))
                    .withEntityStatus(EntityStatus.APPROVED));
    final OntologyAxiom draft =
        SdkClients.adminClient()
            .ontologyAxioms()
            .create(axiomRequest(glossary, "candidateDraft", ex + "Vip", named(ex + "Customer")));
    awaitClosure(
        glossary,
        closure ->
            closure.getIncluded().getAxioms() == 1
                && closure.getExcluded().contains(exclusion(RdfOntologyExclusionReason.DRAFT, 1)));

    final RdfOntologyClosure production = awaitActivation(glossary);
    assertTrue(production.getActive());
    assertTrue(production.getPublished());
    assertEquals(2L, production.getMemberCount(), "the Approved axiom and term");
    final String manifest = production.getManifestGraph().toString();
    assertTrue(
        ask(
            "ASK { GRAPH <%s> { <%s> <http://www.w3.org/2002/07/owl#versionIRI> <%s> } }"
                .formatted(manifest, production.getOntologyIri(), production.getVersionIri())));
    assertTrue(
        ask(
            "ASK { GRAPH <%s> { <%sgraph/axiom/%s> <%spinnedDigest> ?d } }"
                .formatted(manifest, "https://open-metadata.org/", approved.getId(), OMR)));
    assertFalse(
        ask(
            "ASK { GRAPH <%s> { <%sgraph/axiom/%s> ?p ?o } }"
                .formatted(manifest, "https://open-metadata.org/", draft.getId())),
        "the Draft axiom is not pinned");

    final RdfOntologyClosure candidate =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                REASONING
                    + "/closures/"
                    + glossary.getId()
                    + "/candidates?entityId="
                    + draft.getId()
                    + "&entityId="
                    + approved.getId(),
                null,
                RdfOntologyClosure.class);

    assertEquals(RdfOntologySelection.CANDIDATE, candidate.getSelection());
    assertEquals(3L, candidate.getMemberCount());
    assertEquals(RdfOntologyCandidateOutcome.INCLUDED, outcome(candidate, draft.getId()));
    assertEquals(
        RdfOntologyCandidateOutcome.ALREADY_APPROVED, outcome(candidate, approved.getId()));
    assertTrue(candidate.getPublished());
    assertFalse(candidate.getActive());
    assertTrue(
        ask(
            "ASK { GRAPH <%s> { <%sgraph/axiom/%s> <%spinnedDigest> ?d } }"
                .formatted(
                    candidate.getManifestGraph(),
                    "https://open-metadata.org/",
                    draft.getId(),
                    OMR)));
    assertNotNull(candidate.getCheckRequest());
    assertEquals(RdfReasoningOperation.CHECK, candidate.getCheckRequest().getOperation());
    assertEquals(candidate.getClosureDigest(), candidate.getCheckRequest().getOntologyDigest());

    final RdfOntologyClosure after = closure(glossary);
    assertEquals(production.getClosureDigest(), after.getClosureDigest());
    assertTrue(after.getActive(), "production still points at its own manifest");

    final RdfOntologyReasoningStatus status =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.GET, REASONING + "/status", null, RdfOntologyReasoningStatus.class);
    assertTrue(status.getIncluded().getAxioms() >= 1);
    assertTrue(status.getActiveOntologies() >= 1);
  }

  @Test
  void activationAndCandidatesAreRefusedWhileAnImportIsMissing(final TestNamespace namespace)
      throws Exception {
    final Glossary imported = createGlossary(namespace, "imported");
    final Glossary importer =
        namespace.trackRoot(
            Entity.GLOSSARY,
            SdkClients.adminClient()
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(namespace.prefix("importer"))
                        .withDescription("Imports a glossary that is then deleted")
                        .withOntologyConfiguration(
                            new OntologyConfiguration()
                                .withLayer(OntologyLayer.L_3)
                                .withImports(List.of(imported.getEntityReference()))
                                .withPrefixes(List.of())
                                .withIriMintingPattern("{term}")
                                .withReadOnly(false)
                                .withInstalledPacks(List.of()))));
    SdkClients.adminClient()
        .glossaries()
        .delete(imported.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    final OntologyAxiom draft =
        SdkClients.adminClient()
            .ontologyAxioms()
            .create(
                axiomRequest(
                    importer,
                    "importerDraft",
                    "https://example.org/" + namespace.prefix("importer") + "/Vip",
                    named("https://example.org/Customer")));

    final HttpResponse<String> activation =
        post(REASONING + "/closures/" + importer.getId() + "/activation");
    assertRefusedForMissingImport(activation);
    assertFalse(JsonUtils.readValue(activation.body(), RdfOntologyClosure.class).getActive());

    final HttpResponse<String> candidate =
        post(REASONING + "/closures/" + importer.getId() + "/candidates?entityId=" + draft.getId());
    assertRefusedForMissingImport(candidate);
    final RdfOntologyClosure refused =
        JsonUtils.readValue(candidate.body(), RdfOntologyClosure.class);
    assertFalse(refused.getPublished(), "no candidate manifest is written");
    assertFalse(
        ask("ASK { GRAPH <%s> { ?s ?p ?o } }".formatted(refused.getManifestGraph())),
        candidate.body());
  }

  private static void assertRefusedForMissingImport(final HttpResponse<String> response) {
    assertEquals(409, response.statusCode(), response.body());
    final RdfOntologyClosure refused =
        JsonUtils.readValue(response.body(), RdfOntologyClosure.class);
    assertTrue(
        refused.getProblems().stream()
            .anyMatch(problem -> problem.getCode() == RdfOntologyClosureProblemCode.MISSING_IMPORT),
        response.body());
  }

  private static HttpResponse<String> post(final String path) throws Exception {
    return HTTP.send(
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .timeout(Duration.ofSeconds(60))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .POST(HttpRequest.BodyPublishers.noBody())
            .build(),
        HttpResponse.BodyHandlers.ofString());
  }

  private static RdfOntologyClosure closure(final Glossary glossary) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            REASONING + "/closures/" + glossary.getId(),
            null,
            RdfOntologyClosure.class);
  }

  private static RdfOntologyClosure awaitClosure(
      final Glossary glossary, final Predicate<RdfOntologyClosure> condition) {
    final AtomicReference<RdfOntologyClosure> last = new AtomicReference<>();
    Awaitility.await("closure of " + glossary.getName())
        .atMost(PROJECTION_WAIT)
        .pollInterval(POLL_INTERVAL)
        .until(
            () -> {
              last.set(closure(glossary));
              return condition.test(last.get());
            });
    return last.get();
  }

  /** Activation is refused while live projection lags or is degraded, so it is retried. */
  private static RdfOntologyClosure awaitActivation(final Glossary glossary) {
    final AtomicReference<RdfOntologyClosure> active = new AtomicReference<>();
    Awaitility.await("activation of " + glossary.getName())
        .atMost(PROJECTION_WAIT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .until(
            () -> {
              active.set(
                  SdkClients.adminClient()
                      .getHttpClient()
                      .execute(
                          HttpMethod.POST,
                          REASONING + "/closures/" + glossary.getId() + "/activation",
                          null,
                          RdfOntologyClosure.class));
              return active.get() != null;
            });
    return active.get();
  }

  private static RdfOntologyCandidateOutcome outcome(
      final RdfOntologyClosure closure, final UUID entityId) {
    return closure.getCandidates().stream()
        .filter(candidate -> entityId.equals(candidate.getEntityId()))
        .map(RdfOntologyCandidate::getOutcome)
        .findFirst()
        .orElseThrow();
  }

  private static RdfOntologyExclusion exclusion(
      final RdfOntologyExclusionReason reason, final long count) {
    return new RdfOntologyExclusion()
        .withEntityType(Entity.ONTOLOGY_AXIOM)
        .withReason(reason)
        .withCount(count);
  }

  private static boolean ask(final String query) {
    return RdfTestUtils.executeSparqlAsk(query);
  }

  private static void awaitAsk(final String query) {
    Awaitility.await(query)
        .atMost(PROJECTION_WAIT)
        .pollInterval(POLL_INTERVAL)
        .until(() -> RdfTestUtils.executeSparqlAsk(query));
  }

  private static Glossary createGlossary(final TestNamespace namespace, final String name) {
    return namespace.trackRoot(
        Entity.GLOSSARY,
        SdkClients.adminClient()
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(namespace.prefix(name))
                    .withDescription("Ontology closures activated for reasoning")));
  }

  private static void createTerm(final Glossary glossary, final String name) {
    SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withDescription(name + " concept")
                .withGlossary(glossary.getFullyQualifiedName()));
  }

  private static CreateOntologyAxiom axiomRequest(
      final Glossary glossary,
      final String name,
      final String subject,
      final OntologyExpression expression) {
    return new CreateOntologyAxiom()
        .withName(name)
        .withDisplayName(name)
        .withDescription("Axiom selected for reasoning by its lifecycle status")
        .withGlossary(glossary.getFullyQualifiedName())
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(URI.create(subject))
        .withExpressions(List.of(expression))
        .withProvenance(RelationProvenance.MANUAL)
        .withEntityStatus(EntityStatus.DRAFT);
  }

  private static OntologyExpression named(final String iri) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.NAMED_CLASS)
        .withClassIri(URI.create(iri));
  }
}
