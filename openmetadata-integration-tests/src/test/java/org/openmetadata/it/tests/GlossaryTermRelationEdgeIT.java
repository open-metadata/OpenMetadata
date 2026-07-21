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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.GlossaryTermRelationGraph;
import org.openmetadata.schema.api.data.OntologyGraphTruncationReason;
import org.openmetadata.schema.api.data.UpdateTermRelation;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Integration tests for the first-class single-edge relation endpoints introduced in Ontology
 * Studio Phase 2: POST create with provenance/status metadata, PUT change-type, and DELETE. Each
 * test creates its own pair of terms so they are independent and can run concurrently.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryTermRelationEdgeIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

  private OpenMetadataClient client;
  private Glossary glossary;

  @BeforeEach
  void setup(TestNamespace ns) throws Exception {
    client = OssTestServer.defaultHandle().sdk();
    glossary = GlossaryTestFactory.createSimple(ns);
    assertNotNull(glossary, "Test glossary should be created");
  }

  @AfterEach
  void cleanup(TestNamespace ns) {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
  }

  @Test
  void postRelationPersistsProvenanceAndStatus() throws Exception {
    GlossaryTerm from = createTerm("PostFrom");
    GlossaryTerm to = createTerm("PostTo");

    postRelation(from.getId(), to.getId(), "broader", RelationProvenance.MANUAL);

    TermRelation edge = findEdge(from, to.getId());
    assertNotNull(edge, "Relation should exist after POST");
    assertEquals("broader", edge.getRelationType());
    assertEquals(
        RelationProvenance.MANUAL, edge.getProvenance(), "Manual provenance should round-trip");
    assertNotNull(edge.getStatus(), "Status should default and round-trip");
  }

  @Test
  void postRelationWithoutProvenanceDefaultsToManual() throws Exception {
    GlossaryTerm from = createTerm("DefaultFrom");
    GlossaryTerm to = createTerm("DefaultTo");

    postRelation(from.getId(), to.getId(), "synonym", null);

    TermRelation edge = findEdge(from, to.getId());
    assertNotNull(edge, "Relation should exist after POST");
    assertEquals(
        RelationProvenance.MANUAL,
        edge.getProvenance(),
        "Provenance should default to Manual when omitted");
  }

  @Test
  void inferredProvenanceCannotBeAuthoredThroughTheMutationApi() throws Exception {
    GlossaryTerm from = createTerm("InferredFrom");
    GlossaryTerm to = createTerm("InferredTo");

    HttpResponse<String> response =
        postRelationResponse(from.getId(), to.getId(), "broader", RelationProvenance.INFERRED);

    assertEquals(400, response.statusCode(), response.body());
    assertNull(findEdge(from, to.getId()));
  }

  @Test
  void postRelationCreatesVersionFieldChangeAndChangeEvent() throws Exception {
    GlossaryTerm from = createTerm("VersionedPostFrom");
    GlossaryTerm to = createTerm("VersionedPostTo");
    long timestampBeforeUpdate = System.currentTimeMillis() - 1000;

    HttpResponse<String> response =
        postRelationResponse(from.getId(), to.getId(), "broader", RelationProvenance.IMPORTED);

    assertVersionedRelatedTermsChange(response, from.getVersion());
    assertVersionHistoryContainsRelatedTermsChange(from.getId());
    assertUpdateChangeEvent(from.getId(), timestampBeforeUpdate);
  }

  @Test
  void putChangesRelationTypeBidirectionally() throws Exception {
    GlossaryTerm from = createTerm("ChangeFrom");
    GlossaryTerm to = createTerm("ChangeTo");

    postRelation(from.getId(), to.getId(), "broader", RelationProvenance.MANUAL);
    putRelation(from.getId(), to.getId(), "narrower");

    TermRelation fromEdge = findEdge(from, to.getId());
    assertNotNull(fromEdge, "Relation should still exist after PUT");
    assertEquals(
        "narrower", fromEdge.getRelationType(), "Relation type should be changed to narrower");

    // The inverse must be reflected on the other side: to sees 'broader' back to from
    GlossaryTerm reloadedTo =
        client.glossaryTerms().getByName(to.getFullyQualifiedName(), "relatedTerms");
    TermRelation inverse = firstEdgeTo(reloadedTo, from.getId());
    assertNotNull(inverse, "Inverse relation should exist on the target term");
    assertEquals("broader", inverse.getRelationType(), "Inverse of narrower should be broader");
  }

  @Test
  void putRelationCreatesVersionAndFieldChange() throws Exception {
    GlossaryTerm to = createTerm("VersionedPutTo");
    GlossaryTerm from = createTerm("VersionedPutFrom", to);

    HttpResponse<String> response = putRelationResponse(from.getId(), to.getId(), "broader");

    assertVersionedRelatedTermsChange(response, from.getVersion());
  }

  @Test
  void deleteRelationCreatesVersionAndFieldChange() throws Exception {
    GlossaryTerm to = createTerm("VersionedDeleteTo");
    GlossaryTerm from = createTerm("VersionedDeleteFrom", to);

    HttpResponse<String> response = deleteRelationResponse(from.getId(), to.getId(), "relatedTo");

    assertVersionedRelatedTermsChange(response, from.getVersion());
    assertNull(findEdge(from, to.getId()), "the relation should be absent after versioned DELETE");
  }

  @Test
  void putOnNonexistentRelationReturns404() throws Exception {
    GlossaryTerm from = createTerm("MissingFrom");
    GlossaryTerm to = createTerm("MissingTo");

    int status = putRelationRaw(from.getId(), to.getId(), "narrower");
    assertEquals(404, status, "PUT on a nonexistent relation should return 404");
  }

  @Test
  void updateByStableIdPreservesIdentityAndAuditMetadata() throws Exception {
    GlossaryTerm from = createTerm("StableUpdateFrom");
    GlossaryTerm to = createTerm("StableUpdateTo");
    postRelation(from.getId(), to.getId(), "broader", RelationProvenance.MANUAL);
    TermRelation original = findEdge(from, to.getId(), "broader");
    assertNotNull(original);

    HttpResponse<String> response =
        updateRelationById(
            from.getId(),
            original.getId(),
            new UpdateTermRelation()
                .withRelationType("narrower")
                .withProvenance(RelationProvenance.IMPORTED)
                .withStatus(EntityStatus.APPROVED));

    assertVersionedRelatedTermsChange(response, from.getVersion());
    TermRelation updated = findEdge(from, to.getId(), "narrower");
    assertEquals(original.getId(), updated.getId());
    assertEquals(original.getCreatedAt(), updated.getCreatedAt());
    assertEquals(original.getCreatedBy(), updated.getCreatedBy());
    assertEquals(RelationProvenance.IMPORTED, updated.getProvenance());
    assertEquals(EntityStatus.APPROVED, updated.getStatus());
    TermRelation inverse = findEdge(to, from.getId(), "broader");
    assertEquals(original.getId(), inverse.getId());
  }

  @Test
  void partialStableIdUpdatePreservesOmittedFields() throws Exception {
    GlossaryTerm from = createTerm("PartialUpdateFrom");
    GlossaryTerm to = createTerm("PartialUpdateTo");
    postRelation(from.getId(), to.getId(), "broader", RelationProvenance.IMPORTED);
    TermRelation original = findEdge(from, to.getId(), "broader");
    assertNotNull(original);

    HttpResponse<String> response =
        updateRelationById(
            from.getId(),
            original.getId(),
            new UpdateTermRelation().withStatus(EntityStatus.APPROVED));

    assertVersionedRelatedTermsChange(response, from.getVersion());
    TermRelation updated = findEdge(from, to.getId(), "broader");
    assertEquals(original.getId(), updated.getId());
    assertEquals(RelationProvenance.IMPORTED, updated.getProvenance());
    assertEquals(EntityStatus.APPROVED, updated.getStatus());
  }

  @Test
  void deleteByStableIdLeavesOtherRelationshipTypesUntouched() throws Exception {
    GlossaryTerm from = createTerm("StableDeleteFrom");
    GlossaryTerm to = createTerm("StableDeleteTo");
    postRelation(from.getId(), to.getId(), "broader", RelationProvenance.MANUAL);
    postRelation(from.getId(), to.getId(), "synonym", RelationProvenance.MANUAL);
    TermRelation broader = findEdge(from, to.getId(), "broader");
    GlossaryTerm beforeDelete =
        client.glossaryTerms().getByName(from.getFullyQualifiedName(), "relatedTerms");
    assertNotNull(broader);

    HttpResponse<String> response = deleteRelationById(from.getId(), broader.getId());

    assertVersionedRelatedTermsChange(response, beforeDelete.getVersion());
    assertNull(findEdge(from, to.getId(), "broader"));
    assertNotNull(findEdge(from, to.getId(), "synonym"));
  }

  @Test
  void emptyStableIdUpdateIsRejected() throws Exception {
    GlossaryTerm from = createTerm("EmptyUpdateFrom");
    GlossaryTerm to = createTerm("EmptyUpdateTo");
    postRelation(from.getId(), to.getId(), "broader", RelationProvenance.MANUAL);
    TermRelation relation = findEdge(from, to.getId(), "broader");
    assertNotNull(relation);

    HttpResponse<String> response =
        updateRelationById(from.getId(), relation.getId(), new UpdateTermRelation());

    assertEquals(400, response.statusCode(), response.body());
  }

  @Test
  void relationGraphReportsNodeAndEdgeTruncation() throws Exception {
    GlossaryTerm root = createTerm("SliceRoot");
    GlossaryTerm first = createTerm("SliceFirst");
    GlossaryTerm second = createTerm("SliceSecond");
    GlossaryTerm third = createTerm("SliceThird");
    postRelation(root.getId(), first.getId(), "relatedTo", RelationProvenance.MANUAL);
    postRelation(root.getId(), second.getId(), "relatedTo", RelationProvenance.MANUAL);
    postRelation(root.getId(), third.getId(), "relatedTo", RelationProvenance.MANUAL);

    GlossaryTermRelationGraph nodeBounded = relationGraph(root.getId(), 2, 10);
    GlossaryTermRelationGraph edgeBounded = relationGraph(root.getId(), 10, 1);

    assertTrue(nodeBounded.getTruncated());
    assertEquals(OntologyGraphTruncationReason.NODE_LIMIT, nodeBounded.getTruncationReason());
    assertEquals(2, nodeBounded.getNodes().size());
    assertTrue(edgeBounded.getTruncated());
    assertEquals(OntologyGraphTruncationReason.EDGE_LIMIT, edgeBounded.getTruncationReason());
    assertEquals(1, edgeBounded.getEdges().size());
  }

  private GlossaryTerm createTerm(String prefix) throws Exception {
    String name = prefix + "_" + UUID.randomUUID().toString().substring(0, 8);
    return client
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withDescription(name)
                .withGlossary(glossary.getFullyQualifiedName()));
  }

  private GlossaryTerm createTerm(String prefix, GlossaryTerm relatedTerm) throws Exception {
    String name = prefix + "_" + UUID.randomUUID().toString().substring(0, 8);
    return client
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withDescription(name)
                .withGlossary(glossary.getFullyQualifiedName())
                .withRelatedTerms(List.of(relatedTerm.getFullyQualifiedName())));
  }

  private static TermRelation buildBody(UUID toId, String relationType, RelationProvenance prov) {
    TermRelation termRelation =
        new TermRelation()
            .withTerm(new EntityReference().withId(toId).withType("glossaryTerm"))
            .withRelationType(relationType);
    if (prov != null) {
      termRelation.withProvenance(prov);
    }
    return termRelation;
  }

  private void postRelation(UUID fromId, UUID toId, String type, RelationProvenance prov)
      throws Exception {
    HttpResponse<String> response = postRelationResponse(fromId, toId, type, prov);
    assertTrue(
        response.statusCode() >= 200 && response.statusCode() < 300,
        "POST relation should succeed, got " + response.statusCode() + ": " + response.body());
  }

  private HttpResponse<String> postRelationResponse(
      UUID fromId, UUID toId, String type, RelationProvenance prov) throws Exception {
    String url = SdkClients.getServerUrl() + "/v1/glossaryTerms/" + fromId + "/relations";
    return send("POST", url, MAPPER.writeValueAsString(buildBody(toId, type, prov)));
  }

  private void putRelation(UUID fromId, UUID toId, String type) throws Exception {
    assertEquals(200, putRelationRaw(fromId, toId, type), "PUT relation should succeed");
  }

  private int putRelationRaw(UUID fromId, UUID toId, String type) throws Exception {
    return putRelationResponse(fromId, toId, type).statusCode();
  }

  private HttpResponse<String> putRelationResponse(UUID fromId, UUID toId, String type)
      throws Exception {
    String url = SdkClients.getServerUrl() + "/v1/glossaryTerms/" + fromId + "/relations/" + toId;
    return send("PUT", url, MAPPER.writeValueAsString(buildBody(toId, type, null)));
  }

  private HttpResponse<String> deleteRelationResponse(UUID fromId, UUID toId, String type)
      throws Exception {
    String url =
        SdkClients.getServerUrl()
            + "/v1/glossaryTerms/"
            + fromId
            + "/relations/"
            + toId
            + "?relationType="
            + type;
    return send("DELETE", url, "");
  }

  private HttpResponse<String> updateRelationById(
      UUID termId, UUID relationshipId, UpdateTermRelation update) throws Exception {
    String url =
        SdkClients.getServerUrl()
            + "/v1/glossaryTerms/"
            + termId
            + "/relations/id/"
            + relationshipId;
    return send("PUT", url, MAPPER.writeValueAsString(update));
  }

  private HttpResponse<String> deleteRelationById(UUID termId, UUID relationshipId)
      throws Exception {
    String url =
        SdkClients.getServerUrl()
            + "/v1/glossaryTerms/"
            + termId
            + "/relations/id/"
            + relationshipId;
    return send("DELETE", url, "");
  }

  private GlossaryTermRelationGraph relationGraph(UUID termId, int nodeLimit, int edgeLimit)
      throws Exception {
    String url =
        SdkClients.getServerUrl()
            + "/v1/glossaryTerms/"
            + termId
            + "/relationsGraph?depth=1&nodeLimit="
            + nodeLimit
            + "&edgeLimit="
            + edgeLimit;
    HttpResponse<String> response = send("GET", url, "");
    assertEquals(200, response.statusCode(), response.body());
    return MAPPER.readValue(response.body(), GlossaryTermRelationGraph.class);
  }

  private HttpResponse<String> send(String method, String url, String body) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .method(method, HttpRequest.BodyPublishers.ofString(body))
            .build();
    return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private TermRelation findEdge(GlossaryTerm from, UUID toId) throws Exception {
    GlossaryTerm reloaded =
        client.glossaryTerms().getByName(from.getFullyQualifiedName(), "relatedTerms");
    return firstEdgeTo(reloaded, toId);
  }

  private TermRelation findEdge(GlossaryTerm from, UUID toId, String relationType)
      throws Exception {
    GlossaryTerm reloaded =
        client.glossaryTerms().getByName(from.getFullyQualifiedName(), "relatedTerms");
    return firstEdgeTo(reloaded, toId, relationType);
  }

  private static TermRelation firstEdgeTo(GlossaryTerm term, UUID toId) {
    TermRelation result = null;
    if (term.getRelatedTerms() != null) {
      for (TermRelation relation : term.getRelatedTerms()) {
        if (relation.getTerm() != null && toId.equals(relation.getTerm().getId())) {
          result = relation;
          break;
        }
      }
    }
    return result;
  }

  private static TermRelation firstEdgeTo(GlossaryTerm term, UUID toId, String relationType) {
    TermRelation result = null;
    if (term.getRelatedTerms() != null) {
      for (TermRelation relation : term.getRelatedTerms()) {
        boolean hasTarget = relation.getTerm() != null && toId.equals(relation.getTerm().getId());
        if (hasTarget && relationType.equals(relation.getRelationType())) {
          result = relation;
          break;
        }
      }
    }
    return result;
  }

  private static void assertVersionedRelatedTermsChange(
      HttpResponse<String> response, Double originalVersion) throws Exception {
    assertEquals(200, response.statusCode(), response.body());
    JsonNode updated = MAPPER.readTree(response.body());
    assertTrue(
        updated.path("version").asDouble() > originalVersion,
        "the relation mutation must increment the term version: " + response.body());
    JsonNode changeDescription = updated.path("changeDescription");
    assertTrue(
        containsFieldChange(changeDescription, "fieldsAdded", "relatedTerms")
            || containsFieldChange(changeDescription, "fieldsDeleted", "relatedTerms")
            || containsFieldChange(changeDescription, "fieldsUpdated", "relatedTerms"),
        "the response must record a relatedTerms field change: " + response.body());
  }

  private static boolean containsFieldChange(
      JsonNode changeDescription, String changeType, String fieldName) {
    for (JsonNode fieldChange : changeDescription.path(changeType)) {
      if (fieldName.equals(fieldChange.path("name").asText())) {
        return true;
      }
    }
    return false;
  }

  private void assertUpdateChangeEvent(UUID entityId, long timestamp) {
    String url =
        SdkClients.getServerUrl() + "/v1/events?entityUpdated=glossaryTerm&timestamp=" + timestamp;
    await("glossaryTerm update ChangeEvent for " + entityId)
        .atMost(Duration.ofSeconds(10))
        .pollInterval(Duration.ofMillis(250))
        .until(() -> containsUpdateEvent(url, entityId));
  }

  private boolean containsUpdateEvent(String url, UUID entityId) throws Exception {
    HttpResponse<String> response = send("GET", url, "");
    assertEquals(200, response.statusCode(), response.body());
    boolean found = false;
    for (JsonNode event : MAPPER.readTree(response.body()).path("data")) {
      found = found || isUpdateEvent(event, entityId);
    }
    return found;
  }

  private static boolean isUpdateEvent(JsonNode event, UUID entityId) {
    return entityId.toString().equals(event.path("entityId").asText())
        && "entityUpdated".equals(event.path("eventType").asText());
  }

  private void assertVersionHistoryContainsRelatedTermsChange(UUID entityId) throws Exception {
    String url = SdkClients.getServerUrl() + "/v1/glossaryTerms/" + entityId + "/versions";
    HttpResponse<String> response = send("GET", url, "");
    assertEquals(200, response.statusCode(), response.body());
    JsonNode versions = MAPPER.readTree(response.body()).path("versions");
    assertTrue(versions.size() >= 2, "relation mutation must create a new history version");
    for (JsonNode version : versions) {
      JsonNode changeDescription = version.path("changeDescription");
      if (containsFieldChange(changeDescription, "fieldsAdded", "relatedTerms")
          || containsFieldChange(changeDescription, "fieldsDeleted", "relatedTerms")
          || containsFieldChange(changeDescription, "fieldsUpdated", "relatedTerms")) {
        return;
      }
    }
    throw new AssertionError(
        "No relatedTerms field change found in version history for " + entityId);
  }
}
