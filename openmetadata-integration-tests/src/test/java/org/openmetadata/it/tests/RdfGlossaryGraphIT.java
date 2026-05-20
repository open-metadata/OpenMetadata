/*
 *  Copyright 2025 Collate
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.service.rdf.RdfUpdater;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

/**
 * Integration tests for {@code GET /v1/rdf/glossary/graph} (the SPARQL-backed
 * glossary term graph endpoint).
 *
 * <p>Regression for the Novartis issue where the {@code glossaryId} filter was
 * silently ignored — the SPARQL query bound {@code ?glossary} via
 * {@code OPTIONAL { ?term1 om:belongsTo ?glossary }}, but the predicate used
 * when terms are written into RDF is {@code om:belongsToGlossary}. Result:
 * {@code ?glossary} was always unbound, the downstream
 * {@code FILTER(?glossary = <…>)} did not filter, and every term from every
 * glossary came back. The UI then rendered group containers for every glossary
 * instead of just the requested one.
 *
 * <p>See {@link GlossaryOntologyExportIT} for the parallelization and Fuseki
 * container rationale — same pattern applies here.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class RdfGlossaryGraphIT {

  private static final Logger LOG = LoggerFactory.getLogger(RdfGlossaryGraphIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  // See TestSuiteBootstrap for why we use secoresearch/fuseki:5.5.0 instead
  // of the unmaintained stain/jena-fuseki image.
  private static final String FUSEKI_IMAGE = "secoresearch/fuseki:5.5.0";
  private static final int FUSEKI_PORT = 3030;
  private static final String FUSEKI_DATASET = "openmetadata";
  private static final String FUSEKI_ADMIN_PASSWORD = "test-admin";

  private static GenericContainer<?> localFusekiContainer;

  @BeforeAll
  static void enableRdf() {
    String fusekiEndpoint;
    if (TestSuiteBootstrap.isFusekiEnabled()) {
      fusekiEndpoint = TestSuiteBootstrap.getFusekiEndpoint();
    } else {
      // No FUSEKI_DATASET_1 here: that was stain-specific. The dataset is
      // created via /$/datasets by JenaFusekiStorage.ensureDatasetExists().
      // tmpfs the TDB2 dataset dir so writes never hit the container's
      // writable layer — keeps a long IT run from bloating it.
      localFusekiContainer =
          new GenericContainer<>(DockerImageName.parse(FUSEKI_IMAGE))
              .withExposedPorts(FUSEKI_PORT)
              .withEnv("ADMIN_PASSWORD", FUSEKI_ADMIN_PASSWORD)
              .withTmpFs(java.util.Map.of("/fuseki/databases", "rw,size=256m"))
              .waitingFor(
                  Wait.forHttp("/$/ping")
                      .forPort(FUSEKI_PORT)
                      .forStatusCode(200)
                      .withStartupTimeout(Duration.ofMinutes(2)));
      localFusekiContainer.start();
      fusekiEndpoint =
          String.format(
              "http://%s:%d/%s",
              localFusekiContainer.getHost(),
              localFusekiContainer.getMappedPort(FUSEKI_PORT),
              FUSEKI_DATASET);
      LOG.info("Started local Fuseki container: {}", fusekiEndpoint);
    }

    RdfConfiguration rdfConfig = new RdfConfiguration();
    rdfConfig.setEnabled(true);
    rdfConfig.setBaseUri(URI.create("https://open-metadata.org/"));
    rdfConfig.setStorageType(RdfConfiguration.StorageType.FUSEKI);
    rdfConfig.setRemoteEndpoint(URI.create(fusekiEndpoint));
    rdfConfig.setUsername("admin");
    rdfConfig.setPassword(FUSEKI_ADMIN_PASSWORD);
    rdfConfig.setDataset(FUSEKI_DATASET);
    RdfUpdater.initialize(rdfConfig);
  }

  @AfterAll
  static void disableRdf() {
    RdfUpdater.disable();
    if (localFusekiContainer != null) {
      localFusekiContainer.stop();
      localFusekiContainer = null;
    }
  }

  @Test
  void glossaryIdFilterScopesGraphToRequestedGlossary(TestNamespace ns) throws Exception {
    Glossary glossaryA = GlossaryTestFactory.createWithName(ns, "graphScopeA");
    Glossary glossaryB = GlossaryTestFactory.createWithName(ns, "graphScopeB");

    GlossaryTerm termA1 = GlossaryTermTestFactory.createWithName(ns, glossaryA, "a1");
    GlossaryTerm termA2 = GlossaryTermTestFactory.createWithName(ns, glossaryA, "a2");
    GlossaryTerm termB1 = GlossaryTermTestFactory.createWithName(ns, glossaryB, "b1");
    GlossaryTerm termB2 = GlossaryTermTestFactory.createWithName(ns, glossaryB, "b2");

    // Wait for RDF projection of all four terms before asserting against SPARQL.
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              Set<UUID> ids = nodeIds(fetchGlossaryGraph(null));
              assertTrue(ids.contains(termA1.getId()), "RDF should contain termA1");
              assertTrue(ids.contains(termA2.getId()), "RDF should contain termA2");
              assertTrue(ids.contains(termB1.getId()), "RDF should contain termB1");
              assertTrue(ids.contains(termB2.getId()), "RDF should contain termB2");
            });

    JsonNode scoped = fetchGlossaryGraph(glossaryA.getId());
    Set<UUID> scopedIds = nodeIds(scoped);

    assertTrue(
        scopedIds.contains(termA1.getId()),
        "Scoped graph should contain termA1 from the requested glossary");
    assertTrue(
        scopedIds.contains(termA2.getId()),
        "Scoped graph should contain termA2 from the requested glossary");
    assertFalse(
        scopedIds.contains(termB1.getId()),
        "Scoped graph must NOT contain termB1 from a different glossary");
    assertFalse(
        scopedIds.contains(termB2.getId()),
        "Scoped graph must NOT contain termB2 from a different glossary");
  }

  @Test
  void scopedResponseCarriesGlossaryNameAndIdPerNode(TestNamespace ns) throws Exception {
    // Regression for the second symptom of the same bug: the UI's hierarchy
    // view fell back to rendering raw UUIDs as the group container label
    // because the RDF response did not carry the parent glossary's name/id
    // per term. The fix surfaces both `group` (glossary name) and `glossaryId`
    // on every term node so the UI can resolve the label without depending on
    // the caller's glossary listing.
    Glossary glossary = GlossaryTestFactory.createWithName(ns, "labeled");
    GlossaryTerm term = GlossaryTermTestFactory.createWithName(ns, glossary, "t1");

    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () ->
                assertTrue(
                    nodeIds(fetchGlossaryGraph(glossary.getId())).contains(term.getId()),
                    "Term should be projected to RDF before assertion"));

    JsonNode scoped = fetchGlossaryGraph(glossary.getId());
    JsonNode termNode = null;
    for (JsonNode node : scoped.get("nodes")) {
      JsonNode idNode = node.get("id");
      if (idNode != null && term.getId().toString().equals(idNode.asText())) {
        termNode = node;
        break;
      }
    }
    assertNotNull(termNode, "Scoped response should include the created term");

    JsonNode groupNode = termNode.get("group");
    assertNotNull(
        groupNode, "Term node should carry a `group` field with the parent glossary's name");
    assertEquals(
        glossary.getName(),
        groupNode.asText(),
        "Group label should match the parent glossary's name");

    JsonNode glossaryIdNode = termNode.get("glossaryId");
    assertNotNull(glossaryIdNode, "Term node should carry the parent glossary's id");
    assertEquals(glossary.getId().toString(), glossaryIdNode.asText());
  }

  @Test
  void termNodeLabelFallsBackToNameWhenDisplayNameIsAbsent(TestNamespace ns) throws Exception {
    // Regression: the SPARQL query bound the term label via om:name, but the
    // JSON-LD context (base.jsonld) maps the `name` field to rdfs:label, so
    // om:name is never written. Terms without a displayName (skos:prefLabel)
    // therefore came back with a null label, and the UI rendered the entity
    // UUID instead of the human name. Fix reads rdfs:label so every term has
    // a real label whether or not a displayName was supplied.
    Glossary glossary = GlossaryTestFactory.createWithName(ns, "labels");
    GlossaryTerm term = GlossaryTermTestFactory.createWithName(ns, glossary, "noDisplayName");

    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () ->
                assertTrue(
                    nodeIds(fetchGlossaryGraph(glossary.getId())).contains(term.getId()),
                    "Term should be projected to RDF before assertion"));

    JsonNode scoped = fetchGlossaryGraph(glossary.getId());
    JsonNode termNode = null;
    for (JsonNode node : scoped.get("nodes")) {
      JsonNode idNode = node.get("id");
      if (idNode != null && term.getId().toString().equals(idNode.asText())) {
        termNode = node;
        break;
      }
    }
    assertNotNull(termNode, "Scoped response should include the created term");

    JsonNode labelNode = termNode.get("label");
    assertNotNull(labelNode, "Term node should carry a label");
    String label = labelNode.asText();
    assertFalse(label.isBlank(), "Label must not be blank — empty prefLabel should not win");
    assertFalse(
        label.equals(term.getId().toString()),
        "Label must not fall through to the entity UUID when the term name is available");
    assertEquals(
        term.getName(),
        label,
        "Label should be the term's name (rdfs:label) when no displayName is set");
  }

  @Test
  void glossaryIdFilterReturnsEmptyForGlossaryWithNoTerms(TestNamespace ns) throws Exception {
    // A second glossary with terms exists so the SPARQL store is non-empty
    // overall; without the predicate fix the result for the empty glossary
    // would still leak the populated glossary's terms.
    Glossary populatedGlossary = GlossaryTestFactory.createWithName(ns, "populated");
    GlossaryTerm populatedTerm =
        GlossaryTermTestFactory.createWithName(ns, populatedGlossary, "p1");

    Glossary emptyGlossary = GlossaryTestFactory.createWithName(ns, "empty");

    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () ->
                assertTrue(
                    nodeIds(fetchGlossaryGraph(null)).contains(populatedTerm.getId()),
                    "Populated glossary's term should be projected to RDF"));

    JsonNode scoped = fetchGlossaryGraph(emptyGlossary.getId());
    Set<UUID> scopedIds = nodeIds(scoped);

    assertFalse(
        scopedIds.contains(populatedTerm.getId()),
        "Scoped graph for the empty glossary must NOT leak terms from another glossary");
  }

  @Test
  void labelTracksDisplayNameLifecycle(TestNamespace ns) throws Exception {
    // Round-trip the displayName field through the three states that the UI
    // can produce: never set → set to a non-empty value → cleared back to
    // empty. The effective label should follow in BOTH the RDF-backed graph
    // response and the DB-backed term-detail API:
    //   - never set:        the term name (rdfs:label in RDF; .name in DB)
    //   - set:              the display name (skos:prefLabel / .displayName)
    //   - cleared to "":    the term name again, NOT the empty string
    Glossary glossary = GlossaryTestFactory.createWithName(ns, "labelLifecycle");
    GlossaryTerm term = GlossaryTermTestFactory.createWithName(ns, glossary, "term");

    awaitTermInGraph(glossary.getId(), term.getId());

    // 1. No displayName set → label is the term name.
    assertEffectiveLabel(glossary.getId(), term.getId(), term.getName());

    // 2. Set a display name → label switches to it.
    patchTerm(
        term.getId(), "[{\"op\":\"add\",\"path\":\"/displayName\",\"value\":\"Pretty Name\"}]");
    awaitEffectiveLabel(glossary.getId(), term.getId(), "Pretty Name");

    // 3. Update the display name → label tracks the new value.
    patchTerm(
        term.getId(), "[{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"Renamed\"}]");
    awaitEffectiveLabel(glossary.getId(), term.getId(), "Renamed");

    // 4. Clear the display name (set to empty) → label MUST fall back to the
    // term name, not surface as a blank string. This is the symptom we hit in
    // the local stack: COGS had skos:prefLabel="" winning over its rdfs:label
    // and the UI rendered an empty box.
    patchTerm(term.getId(), "[{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"\"}]");
    awaitEffectiveLabel(glossary.getId(), term.getId(), term.getName());
  }

  @Test
  void glossaryMembershipSurvivesAddAndDeleteRelations(TestNamespace ns) throws Exception {
    // Regression for the term-mutation projection path: each call to add or
    // delete a relation re-projects the term to RDF, and a regression in that
    // path can drop the om:belongsToGlossary / rdfs:label triples — at which
    // point the scoped graph query (which anchors on those) silently drops
    // the term. Membership is asserted via both the RDF graph endpoint and
    // the DB-backed term API so the invariant holds in either read mode.
    Glossary glossary = GlossaryTestFactory.createWithName(ns, "membership");
    GlossaryTerm a = GlossaryTermTestFactory.createWithName(ns, glossary, "alpha");
    GlossaryTerm b = GlossaryTermTestFactory.createWithName(ns, glossary, "beta");

    awaitTermInGraph(glossary.getId(), a.getId());
    awaitTermInGraph(glossary.getId(), b.getId());

    addRelation(a.getId(), b.getId(), "relatedTo");
    awaitMembershipAndLabel(glossary, a, a.getName());
    awaitMembershipAndLabel(glossary, b, b.getName());
    awaitRelatedTermInDb(a.getId(), b.getId(), "relatedTo");

    deleteRelation(a.getId(), b.getId(), "relatedTo");
    awaitMembershipAndLabel(glossary, a, a.getName());
    awaitMembershipAndLabel(glossary, b, b.getName());
    awaitRelatedTermAbsentInDb(a.getId(), b.getId());
  }

  @Test
  void sameTermPairCanHoldMultipleRelationTypesIndependently(TestNamespace ns) throws Exception {
    // Per PR #28172 the (fromId, toId, relation, relationType) PK lets the
    // same term pair carry multiple typed relations. Verify that adding a
    // second relation type does NOT remove the first, and that removing one
    // type leaves the other intact — both in the DB term record and in the
    // RDF graph response.
    Glossary glossary = GlossaryTestFactory.createWithName(ns, "multiRel");
    GlossaryTerm a = GlossaryTermTestFactory.createWithName(ns, glossary, "alpha");
    GlossaryTerm b = GlossaryTermTestFactory.createWithName(ns, glossary, "beta");

    awaitTermInGraph(glossary.getId(), a.getId());
    awaitTermInGraph(glossary.getId(), b.getId());

    addRelation(a.getId(), b.getId(), "relatedTo");
    awaitRelatedTermInDb(a.getId(), b.getId(), "relatedTo");

    addRelation(a.getId(), b.getId(), "synonym");
    // Both types must coexist on the DB term.
    awaitRelatedTermInDb(a.getId(), b.getId(), "relatedTo");
    awaitRelatedTermInDb(a.getId(), b.getId(), "synonym");
    // And the RDF graph must surface both edges.
    awaitEdgeBetween(glossary.getId(), a.getId(), b.getId(), "relatedTo");
    awaitEdgeBetween(glossary.getId(), a.getId(), b.getId(), "synonym");

    // Removing one type must leave the other in place.
    deleteRelation(a.getId(), b.getId(), "relatedTo");
    awaitRelatedTermOfTypeAbsentInDb(a.getId(), b.getId(), "relatedTo");
    awaitRelatedTermInDb(a.getId(), b.getId(), "synonym");
    awaitEdgeBetween(glossary.getId(), a.getId(), b.getId(), "synonym");

    // Membership and label survive all of it.
    awaitMembershipAndLabel(glossary, a, a.getName());
    awaitMembershipAndLabel(glossary, b, b.getName());
  }

  @Test
  void customRdfPredicateRelationSurfacesInGraphEndpoint(TestNamespace ns) throws Exception {
    // Regression: GlossaryTermRelationSettings lets operators define custom
    // relation types with arbitrary rdfPredicate URIs (e.g. "Enrolls In" with
    // rdfPredicate https://example.com/ontology/enrolls). The writer
    // (bulkAddGlossaryTermRelations / addGlossaryTermRelation) honoured those
    // custom predicates and wrote the triples to Fuseki correctly. The reader
    // (RdfRepository.buildGlossaryTermGraphQuery) hardcoded its SPARQL
    // FILTER ?relationType IN (...) to the built-in CURIE list, silently
    // dropping every custom-typed edge. Customer environments saw their
    // relations in the Overview tab (DB-backed) but the term-page Relations
    // Graph (the RDF-backed view) rendered only the source node alone — the
    // image-v6 / image-v8 case in the bug report. None of the existing tests
    // exercised this writer/reader symmetry because they all stuck to built-in
    // relation types.
    //
    // This test registers a custom relation type via the settings API, points
    // two terms at each other through it, and asserts the graph endpoint
    // returns the edge. Cleans up the settings entry on the way out so
    // parallel/subsequent tests aren't affected.
    String customTypeName = "regressionCustomRel";
    URI customPredicate = URI.create("https://example.com/regression/customRel");
    addCustomRelationTypeToSettings(customTypeName, customPredicate);
    try {
      Glossary glossary = GlossaryTestFactory.createWithName(ns, "customRdfPred");
      GlossaryTerm a = GlossaryTermTestFactory.createWithName(ns, glossary, "alpha");
      GlossaryTerm b = GlossaryTermTestFactory.createWithName(ns, glossary, "beta");

      awaitTermInGraph(glossary.getId(), a.getId());
      awaitTermInGraph(glossary.getId(), b.getId());

      addRelation(a.getId(), b.getId(), customTypeName);
      awaitRelatedTermInDb(a.getId(), b.getId(), customTypeName);

      // The fix: buildGlossaryTermGraphQuery must read configured custom
      // predicates from GlossaryTermRelationSettings and append them to the
      // FILTER list. Without the fix this edge is silently filtered out
      // and the graph endpoint returns nodes-but-no-edges for the source
      // term — exactly the customer's symptom.
      awaitEdgeBetween(glossary.getId(), a.getId(), b.getId(), customTypeName);
    } finally {
      removeCustomRelationTypeFromSettings(customTypeName);
    }
  }

  @Test
  void customRelationWithNullRdfPredicateSurfacesInGraphEndpoint(TestNamespace ns)
      throws Exception {
    // Companion to customRdfPredicateRelationSurfacesInGraphEndpoint covering
    // the OTHER half of the customer's actual configuration: a custom relation
    // type registered in GlossaryTermRelationSettings WITHOUT a populated
    // rdfPredicate (the Novartis instance had `definedby`, `enabledby`,
    // `enrollsin` all stored with rdfPredicate=null). On the writer side
    // getGlossaryTermRelationPredicate falls back to
    // `https://open-metadata.org/ontology/<name>`; the reader fix must mirror
    // that fallback or the edges still don't surface.
    String customTypeName = "regressionNullPredRel";
    addCustomRelationTypeToSettings(customTypeName, /* rdfPredicate */ null);
    try {
      Glossary glossary = GlossaryTestFactory.createWithName(ns, "nullRdfPred");
      GlossaryTerm a = GlossaryTermTestFactory.createWithName(ns, glossary, "gamma");
      GlossaryTerm b = GlossaryTermTestFactory.createWithName(ns, glossary, "delta");

      awaitTermInGraph(glossary.getId(), a.getId());
      awaitTermInGraph(glossary.getId(), b.getId());

      addRelation(a.getId(), b.getId(), customTypeName);
      awaitRelatedTermInDb(a.getId(), b.getId(), customTypeName);

      // Without the null-rdfPredicate fallback in the reader's FILTER assembly,
      // this edge (written as om:regressionNullPredRel) is filtered out.
      awaitEdgeBetween(glossary.getId(), a.getId(), b.getId(), customTypeName);
    } finally {
      removeCustomRelationTypeFromSettings(customTypeName);
    }
  }

  /**
   * PUT a new relation type onto the system-level GlossaryTermRelationSettings.
   * Preserves whatever's already configured (defaults + any types from earlier
   * tests still on the way out) and appends our custom one. Pass {@code null}
   * for {@code rdfPredicate} to exercise the "operator added a type but didn't
   * fill in the RDF predicate URI" case — the writer falls back to
   * {@code om:<name>} and the reader must mirror that fallback.
   */
  private void addCustomRelationTypeToSettings(String name, URI rdfPredicate) throws Exception {
    JsonNode existing = fetchGlossaryTermRelationSettings();
    com.fasterxml.jackson.databind.node.ObjectNode payload = MAPPER.createObjectNode();
    payload.put("config_type", "glossaryTermRelationSettings");
    com.fasterxml.jackson.databind.node.ObjectNode value = MAPPER.createObjectNode();
    com.fasterxml.jackson.databind.node.ArrayNode types = MAPPER.createArrayNode();
    if (existing != null && existing.has("relationTypes")) {
      existing.get("relationTypes").forEach(types::add);
    }
    com.fasterxml.jackson.databind.node.ObjectNode custom = MAPPER.createObjectNode();
    custom.put("name", name);
    if (rdfPredicate != null) {
      custom.put("rdfPredicate", rdfPredicate.toString());
    }
    types.add(custom);
    value.set("relationTypes", types);
    payload.set("config_value", value);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/system/settings"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .PUT(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(payload)))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(
        200,
        response.statusCode(),
        () -> "PUT settings failed: " + response.statusCode() + " " + response.body());
  }

  private void removeCustomRelationTypeFromSettings(String name) {
    try {
      JsonNode existing = fetchGlossaryTermRelationSettings();
      if (existing == null || !existing.has("relationTypes")) {
        return;
      }
      com.fasterxml.jackson.databind.node.ObjectNode payload = MAPPER.createObjectNode();
      payload.put("config_type", "glossaryTermRelationSettings");
      com.fasterxml.jackson.databind.node.ObjectNode value = MAPPER.createObjectNode();
      com.fasterxml.jackson.databind.node.ArrayNode kept = MAPPER.createArrayNode();
      for (JsonNode t : existing.get("relationTypes")) {
        if (!name.equals(t.path("name").asText(null))) {
          kept.add(t);
        }
      }
      value.set("relationTypes", kept);
      payload.set("config_value", value);
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(SdkClients.getServerUrl() + "/v1/system/settings"))
              .header("Authorization", "Bearer " + SdkClients.getAdminToken())
              .header("Content-Type", "application/json")
              .timeout(Duration.ofSeconds(30))
              .PUT(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(payload)))
              .build();
      HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    } catch (Exception e) {
      LOG.warn("Failed to remove custom relation type {} from settings", name, e);
    }
  }

  private JsonNode fetchGlossaryTermRelationSettings() throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/system/settings"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200) {
      return null;
    }
    JsonNode all = MAPPER.readTree(response.body());
    for (JsonNode s : all.path("data")) {
      if ("glossaryTermRelationSettings".equals(s.path("config_type").asText(null))) {
        JsonNode value = s.get("config_value");
        if (value != null && value.isTextual()) {
          return MAPPER.readTree(value.asText());
        }
        return value;
      }
    }
    return null;
  }

  @Test
  void changingRelationTypeReplacesOldEdgeWithNewType(TestNamespace ns) throws Exception {
    // Simulates the UI "edit relation type" flow as delete-then-add. Verify
    // the resulting state is exactly one edge of the new type, no orphans.
    Glossary glossary = GlossaryTestFactory.createWithName(ns, "swapRel");
    GlossaryTerm a = GlossaryTermTestFactory.createWithName(ns, glossary, "from");
    GlossaryTerm b = GlossaryTermTestFactory.createWithName(ns, glossary, "to");

    awaitTermInGraph(glossary.getId(), a.getId());
    awaitTermInGraph(glossary.getId(), b.getId());

    addRelation(a.getId(), b.getId(), "relatedTo");
    awaitEdgeBetween(glossary.getId(), a.getId(), b.getId(), "relatedTo");

    deleteRelation(a.getId(), b.getId(), "relatedTo");
    addRelation(a.getId(), b.getId(), "broader");

    awaitRelatedTermInDb(a.getId(), b.getId(), "broader");
    awaitEdgeBetween(glossary.getId(), a.getId(), b.getId(), "broader");

    // The previous relation type must NOT linger in either layer.
    Awaitility.await()
        .atMost(Duration.ofSeconds(15))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              JsonNode term = fetchTerm(a.getId());
              for (JsonNode r : term.path("relatedTerms")) {
                if (b.getId().toString().equals(r.path("term").path("id").asText(null))) {
                  assertFalse(
                      "relatedTo".equals(r.path("relationType").asText(null)),
                      "Old relationType must be gone after delete+add");
                }
              }
              assertFalse(
                  hasEdge(fetchGlossaryGraph(glossary.getId()), a.getId(), b.getId(), "relatedTo"),
                  "Old edge type must not linger in the RDF graph");
            });

    // Membership/label still intact.
    awaitMembershipAndLabel(glossary, a, a.getName());
    awaitMembershipAndLabel(glossary, b, b.getName());
  }

  @Test
  void crossGlossaryRelationDoesNotLeakIntoOtherGlossaryScope(TestNamespace ns) throws Exception {
    // A cross-glossary relation creates an outbound edge but should not make
    // the source term a "member" of the target glossary. Scoping by the
    // target glossary's id must still exclude the foreign source term as a
    // primary node.
    Glossary glossaryA = GlossaryTestFactory.createWithName(ns, "crossA");
    Glossary glossaryB = GlossaryTestFactory.createWithName(ns, "crossB");
    GlossaryTerm a1 = GlossaryTermTestFactory.createWithName(ns, glossaryA, "a1");
    GlossaryTerm b1 = GlossaryTermTestFactory.createWithName(ns, glossaryB, "b1");

    awaitTermInGraph(glossaryA.getId(), a1.getId());
    awaitTermInGraph(glossaryB.getId(), b1.getId());

    addRelation(a1.getId(), b1.getId(), "relatedTo");

    // a1 must still be a first-class member of glossaryA after the cross-glossary relation.
    awaitMembershipAndLabel(glossaryA, a1, a1.getName());

    // a1 may surface inside glossaryB's scoped graph as a term2 (edge target),
    // but it must NEVER appear as a primary node attributed to glossaryB —
    // i.e. it must not carry glossaryB's id / name.
    JsonNode scopedB = fetchGlossaryGraph(glossaryB.getId());
    for (JsonNode node : scopedB.get("nodes")) {
      if (a1.getId().toString().equals(node.path("id").asText(null))) {
        String group = node.path("group").asText(null);
        String gid = node.path("glossaryId").asText(null);
        assertFalse(
            glossaryB.getName().equals(group),
            "Foreign term must not be attributed to the scoped glossary's name");
        assertFalse(
            glossaryB.getId().toString().equals(gid),
            "Foreign term must not carry the scoped glossary's id");
      }
    }
  }

  private void awaitTermInGraph(UUID glossaryId, UUID termId) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () ->
                assertTrue(
                    nodeIds(fetchGlossaryGraph(glossaryId)).contains(termId),
                    () -> "Term " + termId + " should be projected to RDF"));
  }

  /**
   * Resolve the term's effective UI label the same way the UI does: prefer a
   * non-blank displayName, otherwise fall back to the term name. Asserted on
   * the DB-backed term API (works whether RDF is enabled or not).
   */
  private static String effectiveLabel(JsonNode term) {
    String displayName = term.path("displayName").asText(null);
    if (displayName != null && !displayName.isBlank()) {
      return displayName;
    }
    return term.path("name").asText(null);
  }

  /** Assert the term's effective label via BOTH the RDF graph and the DB term API. */
  private void assertEffectiveLabel(UUID glossaryId, UUID termId, String expected)
      throws Exception {
    JsonNode dbTerm = fetchTerm(termId);
    assertEquals(expected, effectiveLabel(dbTerm), "DB term effective label should match expected");
    JsonNode graphNode = findNode(fetchGlossaryGraph(glossaryId), termId);
    assertEquals(
        expected,
        graphNode.path("label").asText(null),
        "RDF graph node label should match expected");
  }

  /** Same as {@link #assertEffectiveLabel} but polls until consistent (post-mutation). */
  private void awaitEffectiveLabel(UUID glossaryId, UUID termId, String expected) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(() -> assertEffectiveLabel(glossaryId, termId, expected));
  }

  /**
   * After a mutation, assert the term still appears scoped to the correct
   * glossary (with proper group/glossaryId/label) in the RDF graph AND that
   * the DB still reports the term as a member of the same glossary.
   */
  private void awaitMembershipAndLabel(Glossary glossary, GlossaryTerm term, String expectedLabel) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              JsonNode dbTerm = fetchTerm(term.getId());
              JsonNode dbGlossary = dbTerm.path("glossary");
              assertEquals(
                  glossary.getId().toString(),
                  dbGlossary.path("id").asText(null),
                  "DB term must report correct parent glossary id");
              assertEquals(
                  glossary.getName(),
                  dbGlossary.path("name").asText(null),
                  "DB term must report correct parent glossary name");
              assertEquals(expectedLabel, effectiveLabel(dbTerm));

              JsonNode graphNode = findNode(fetchGlossaryGraph(glossary.getId()), term.getId());
              assertNotNull(
                  graphNode.get("id"), () -> "Term " + term.getId() + " missing from scoped graph");
              assertEquals(glossary.getName(), graphNode.path("group").asText(null));
              assertEquals(glossary.getId().toString(), graphNode.path("glossaryId").asText(null));
              assertEquals(expectedLabel, graphNode.path("label").asText(null));
            });
  }

  private void awaitRelatedTermInDb(UUID fromTermId, UUID toTermId, String expectedRelationType) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(15))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              JsonNode term = fetchTerm(fromTermId);
              JsonNode related = term.path("relatedTerms");
              boolean found = false;
              for (JsonNode r : related) {
                if (toTermId.toString().equals(r.path("term").path("id").asText(null))
                    && expectedRelationType.equals(r.path("relationType").asText(null))) {
                  found = true;
                  break;
                }
              }
              assertTrue(
                  found,
                  () ->
                      "Expected DB term "
                          + fromTermId
                          + " to have relatedTerm "
                          + toTermId
                          + " of type "
                          + expectedRelationType);
            });
  }

  private boolean hasEdge(JsonNode graph, UUID fromId, UUID toId, String relationType) {
    JsonNode edges = graph.path("edges");
    String from = fromId.toString();
    String to = toId.toString();
    for (JsonNode e : edges) {
      String f = e.path("from").asText(null);
      String t = e.path("to").asText(null);
      String type = e.path("relationType").asText(null);
      boolean idsMatch = (from.equals(f) && to.equals(t)) || (from.equals(t) && to.equals(f));
      if (idsMatch && relationType.equalsIgnoreCase(type)) {
        return true;
      }
    }
    return false;
  }

  private void awaitEdgeBetween(UUID glossaryId, UUID fromId, UUID toId, String relationType) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () ->
                assertTrue(
                    hasEdge(fetchGlossaryGraph(glossaryId), fromId, toId, relationType),
                    () ->
                        "Expected edge "
                            + fromId
                            + " -["
                            + relationType
                            + "]-> "
                            + toId
                            + " in RDF graph"));
  }

  private void awaitRelatedTermOfTypeAbsentInDb(
      UUID fromTermId, UUID toTermId, String relationType) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(15))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              JsonNode term = fetchTerm(fromTermId);
              for (JsonNode r : term.path("relatedTerms")) {
                if (toTermId.toString().equals(r.path("term").path("id").asText(null))
                    && relationType.equals(r.path("relationType").asText(null))) {
                  fail(
                      "DB term "
                          + fromTermId
                          + " should no longer reference "
                          + toTermId
                          + " of type "
                          + relationType);
                }
              }
            });
  }

  private void awaitRelatedTermAbsentInDb(UUID fromTermId, UUID toTermId) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(15))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              JsonNode term = fetchTerm(fromTermId);
              for (JsonNode r : term.path("relatedTerms")) {
                assertFalse(
                    toTermId.toString().equals(r.path("term").path("id").asText(null)),
                    () ->
                        "DB term "
                            + fromTermId
                            + " should no longer reference deleted relation to "
                            + toTermId);
              }
            });
  }

  private JsonNode fetchTerm(UUID termId) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl()
                        + "/v1/glossaryTerms/"
                        + termId
                        + "?fields=relatedTerms,glossary"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(
        200,
        response.statusCode(),
        () -> "Fetch term failed: " + response.statusCode() + " " + response.body());
    return MAPPER.readTree(response.body());
  }

  private JsonNode findNode(JsonNode graph, UUID termId) {
    for (JsonNode node : graph.get("nodes")) {
      if (termId.toString().equals(node.path("id").asText(null))) {
        return node;
      }
    }
    return MAPPER.createObjectNode();
  }

  private void patchTerm(UUID termId, String jsonPatch) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/glossaryTerms/" + termId))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json-patch+json")
            .timeout(Duration.ofSeconds(30))
            .method("PATCH", HttpRequest.BodyPublishers.ofString(jsonPatch))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(
        200,
        response.statusCode(),
        () -> "PATCH term failed: " + response.statusCode() + " " + response.body());
  }

  private void addRelation(UUID fromId, UUID toId, String relationType) throws Exception {
    String body =
        String.format(
            "{\"term\":{\"id\":\"%s\",\"type\":\"glossaryTerm\"},\"relationType\":\"%s\"}",
            toId, relationType);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl() + "/v1/glossaryTerms/" + fromId + "/relations"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(
        200,
        response.statusCode(),
        () -> "Add relation failed: " + response.statusCode() + " " + response.body());
  }

  private void deleteRelation(UUID fromId, UUID toId, String relationType) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl()
                        + "/v1/glossaryTerms/"
                        + fromId
                        + "/relations/"
                        + toId
                        + "?relationType="
                        + relationType))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .timeout(Duration.ofSeconds(30))
            .DELETE()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(
        200,
        response.statusCode(),
        () -> "Delete relation failed: " + response.statusCode() + " " + response.body());
  }

  private JsonNode fetchGlossaryGraph(UUID glossaryId) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();
    String url = String.format("%s/v1/rdf/glossary/graph?limit=500", baseUrl);
    if (glossaryId != null) {
      url = url + "&glossaryId=" + glossaryId;
    }
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(60))
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(
        200,
        response.statusCode(),
        () -> "Expected 200 OK from /v1/rdf/glossary/graph; body=" + response.body());
    JsonNode body = MAPPER.readTree(response.body());
    assertNotNull(body.get("nodes"), "Response should include a nodes array");
    return body;
  }

  private Set<UUID> nodeIds(JsonNode graph) {
    Set<UUID> ids = new HashSet<>();
    for (JsonNode node : graph.get("nodes")) {
      JsonNode idNode = node.get("id");
      if (idNode != null && !idNode.isNull()) {
        try {
          ids.add(UUID.fromString(idNode.asText()));
        } catch (IllegalArgumentException ignored) {
          // Non-UUID ids (e.g. glossary URIs) are not term identifiers — skip.
        }
      }
    }
    return ids;
  }
}
