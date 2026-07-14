package org.openmetadata.it.tests;

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
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Integration tests for the first-class single-edge relation endpoints introduced in Ontology
 * Studio Phase 2: POST create with provenance/status metadata, PUT change-type, and DELETE. Each
 * test creates its own pair of terms so they are independent and can run concurrently.
 */
@Execution(ExecutionMode.CONCURRENT)
public class GlossaryTermRelationEdgeIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

  private static OpenMetadataClient client;
  private static Glossary glossary;

  @BeforeAll
  static void setup() throws Exception {
    client = SdkClients.adminClient();
    String glossaryName = "OntologyStudioEdges_" + UUID.randomUUID().toString().substring(0, 8);
    glossary =
        client
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(glossaryName)
                    .withDescription("Glossary for single-edge relation endpoint tests"));
    assertNotNull(glossary, "Test glossary should be created");
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

  // ---- helpers ----

  private static GlossaryTerm createTerm(String prefix) throws Exception {
    String name = prefix + "_" + UUID.randomUUID().toString().substring(0, 8);
    return client
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withDescription(name)
                .withGlossary(glossary.getFullyQualifiedName()));
  }

  private static GlossaryTerm createTerm(String prefix, GlossaryTerm relatedTerm) throws Exception {
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

  private static void postRelation(UUID fromId, UUID toId, String type, RelationProvenance prov)
      throws Exception {
    HttpResponse<String> response = postRelationResponse(fromId, toId, type, prov);
    assertTrue(
        response.statusCode() >= 200 && response.statusCode() < 300,
        "POST relation should succeed, got " + response.statusCode() + ": " + response.body());
  }

  private static HttpResponse<String> postRelationResponse(
      UUID fromId, UUID toId, String type, RelationProvenance prov) throws Exception {
    String url = SdkClients.getServerUrl() + "/v1/glossaryTerms/" + fromId + "/relations";
    return send("POST", url, MAPPER.writeValueAsString(buildBody(toId, type, prov)));
  }

  private static void putRelation(UUID fromId, UUID toId, String type) throws Exception {
    assertEquals(200, putRelationRaw(fromId, toId, type), "PUT relation should succeed");
  }

  private static int putRelationRaw(UUID fromId, UUID toId, String type) throws Exception {
    return putRelationResponse(fromId, toId, type).statusCode();
  }

  private static HttpResponse<String> putRelationResponse(UUID fromId, UUID toId, String type)
      throws Exception {
    String url = SdkClients.getServerUrl() + "/v1/glossaryTerms/" + fromId + "/relations/" + toId;
    return send("PUT", url, MAPPER.writeValueAsString(buildBody(toId, type, null)));
  }

  private static HttpResponse<String> deleteRelationResponse(UUID fromId, UUID toId, String type)
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

  private static HttpResponse<String> send(String method, String url, String body)
      throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .method(method, HttpRequest.BodyPublishers.ofString(body))
            .build();
    return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static TermRelation findEdge(GlossaryTerm from, UUID toId) throws Exception {
    GlossaryTerm reloaded =
        client.glossaryTerms().getByName(from.getFullyQualifiedName(), "relatedTerms");
    return firstEdgeTo(reloaded, toId);
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

  private static void assertUpdateChangeEvent(UUID entityId, long timestamp) throws Exception {
    String url =
        SdkClients.getServerUrl() + "/v1/events?entityUpdated=glossaryTerm&timestamp=" + timestamp;
    for (int attempt = 0; attempt < 20; attempt++) {
      HttpResponse<String> response = send("GET", url, "");
      assertEquals(200, response.statusCode(), response.body());
      for (JsonNode event : MAPPER.readTree(response.body()).path("data")) {
        if (entityId.toString().equals(event.path("entityId").asText())
            && "entityUpdated".equals(event.path("eventType").asText())) {
          return;
        }
      }
      Thread.sleep(250);
    }
    throw new AssertionError("No glossaryTerm update ChangeEvent found for " + entityId);
  }

  private static void assertVersionHistoryContainsRelatedTermsChange(UUID entityId)
      throws Exception {
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
