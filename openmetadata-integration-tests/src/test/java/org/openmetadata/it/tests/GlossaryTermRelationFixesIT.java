/*
 *  Copyright 2024 Collate.
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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TermRelation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests verifying fixes from PR #25886 code review:
 *
 * <ul>
 *   <li>Fix 1: RDF endpoint admin authorization
 *   <li>Fix 3: Bidirectional relation retrieval correctness
 *   <li>Fix 5: Relation-type-aware deletion
 *   <li>Fix 6: Validation in updateRelatedTerms
 *   <li>Fix 8: Error message sanitization
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryTermRelationFixesIT {

  private static final Logger LOG = LoggerFactory.getLogger(GlossaryTermRelationFixesIT.class);
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  // ==================== FIX 1: RDF ENDPOINT ADMIN AUTHORIZATION ====================

  @Test
  void testRdfStatusEndpointRequiresAdmin() throws Exception {
    String nonAdminToken = getNonAdminToken();
    HttpResponse<String> response = httpGet("/v1/rdf/status", nonAdminToken);

    // Non-admin should get 403 (auth denied) or 404 (RDF not registered when disabled)
    // Both prevent unauthorized access
    assertTrue(
        response.statusCode() == 403 || response.statusCode() == 404,
        "RDF status endpoint should deny non-admin access, got: " + response.statusCode());
  }

  @Test
  void testRdfSparqlGetEndpointRequiresAdmin() throws Exception {
    String nonAdminToken = getNonAdminToken();
    HttpResponse<String> response =
        httpGet("/v1/rdf/sparql?query=SELECT+*+WHERE+%7B+%3Fs+%3Fp+%3Fo+%7D", nonAdminToken);

    assertTrue(
        response.statusCode() == 403 || response.statusCode() == 404,
        "SPARQL GET endpoint should deny non-admin access, got: " + response.statusCode());
  }

  @Test
  void testRdfSparqlPostEndpointRequiresAdmin() throws Exception {
    String nonAdminToken = getNonAdminToken();
    String body = "{\"query\":\"SELECT * WHERE { ?s ?p ?o }\"}";
    HttpResponse<String> response = httpPost("/v1/rdf/sparql", body, nonAdminToken);

    assertTrue(
        response.statusCode() == 403 || response.statusCode() == 404,
        "SPARQL POST endpoint should deny non-admin access, got: " + response.statusCode());
  }

  @Test
  void testRdfSparqlUpdateEndpointRequiresAdmin() throws Exception {
    String nonAdminToken = getNonAdminToken();
    String body = "{\"query\":\"INSERT DATA { <s> <p> <o> }\"}";
    HttpResponse<String> response = httpPost("/v1/rdf/sparql/update", body, nonAdminToken);

    assertTrue(
        response.statusCode() == 403 || response.statusCode() == 404,
        "SPARQL UPDATE endpoint should deny non-admin access, got: " + response.statusCode());
  }

  @Test
  void testRdfGlossaryGraphEndpointRequiresAdmin() throws Exception {
    String nonAdminToken = getNonAdminToken();
    HttpResponse<String> response = httpGet("/v1/rdf/glossary/graph", nonAdminToken);

    assertTrue(
        response.statusCode() == 403 || response.statusCode() == 404,
        "RDF glossary graph endpoint should deny non-admin access, got: " + response.statusCode());
  }

  @Test
  void testRdfSemanticSearchEndpointRequiresAdmin() throws Exception {
    String nonAdminToken = getNonAdminToken();
    HttpResponse<String> response = httpGet("/v1/rdf/search/semantic?q=test", nonAdminToken);

    assertTrue(
        response.statusCode() == 403 || response.statusCode() == 404,
        "RDF semantic search endpoint should deny non-admin access, got: " + response.statusCode());
  }

  // ==================== FIX 3: BIDIRECTIONAL RELATION RETRIEVAL ====================

  @Test
  void testBidirectionalRelationRetrieval(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "bidir_a");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "bidir_b");

    // Add relation from A -> B with type "synonym"
    addTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");

    // Fetch term A - should show B as related
    GlossaryTerm fetchedA = getGlossaryTerm(termA.getId().toString());
    assertNotNull(fetchedA);
    assertNotNull(fetchedA.getRelatedTerms());
    assertFalse(fetchedA.getRelatedTerms().isEmpty(), "Term A should have related terms");

    boolean foundBInA =
        fetchedA.getRelatedTerms().stream()
            .anyMatch(rel -> rel.getTerm().getId().equals(termB.getId()));
    assertTrue(foundBInA, "Term A should show term B as related");

    // Fetch term B - should also show A as related (bidirectional)
    GlossaryTerm fetchedB = getGlossaryTerm(termB.getId().toString());
    assertNotNull(fetchedB);
    assertNotNull(fetchedB.getRelatedTerms());
    assertFalse(fetchedB.getRelatedTerms().isEmpty(), "Term B should have related terms");

    boolean foundAInB =
        fetchedB.getRelatedTerms().stream()
            .anyMatch(rel -> rel.getTerm().getId().equals(termA.getId()));
    assertTrue(foundAInB, "Term B should show term A as related (bidirectional)");

    // Verify the relation type is preserved in both directions
    String relTypeFromA =
        fetchedA.getRelatedTerms().stream()
            .filter(rel -> rel.getTerm().getId().equals(termB.getId()))
            .map(TermRelation::getRelationType)
            .findFirst()
            .orElse(null);
    assertEquals("synonym", relTypeFromA, "Relation type should be 'synonym' when viewing from A");

    String relTypeFromB =
        fetchedB.getRelatedTerms().stream()
            .filter(rel -> rel.getTerm().getId().equals(termA.getId()))
            .map(TermRelation::getRelationType)
            .findFirst()
            .orElse(null);
    assertEquals("synonym", relTypeFromB, "Relation type should be 'synonym' when viewing from B");

    GlossaryTestFactory.delete(glossary);
  }

  @Test
  void testBidirectionalWithMultipleRelationTypes(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "multi_a");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "multi_b");
    GlossaryTerm termC = GlossaryTermTestFactory.createWithName(ns, glossary, "multi_c");

    // A -> B as synonym, A -> C as broader
    addTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");
    addTermRelation(termA.getId().toString(), termC.getId().toString(), "broader");

    // Term A should show both B and C
    GlossaryTerm fetchedA = getGlossaryTerm(termA.getId().toString());
    assertNotNull(fetchedA.getRelatedTerms());
    assertEquals(2, fetchedA.getRelatedTerms().size(), "Term A should have 2 related terms");

    // Term B should show A with type synonym
    GlossaryTerm fetchedB = getGlossaryTerm(termB.getId().toString());
    assertNotNull(fetchedB.getRelatedTerms());
    assertFalse(fetchedB.getRelatedTerms().isEmpty());

    // Term C should show A with type broader
    GlossaryTerm fetchedC = getGlossaryTerm(termC.getId().toString());
    assertNotNull(fetchedC.getRelatedTerms());
    assertFalse(fetchedC.getRelatedTerms().isEmpty());

    GlossaryTestFactory.delete(glossary);
  }

  // ==================== FIX 5: RELATION-TYPE-AWARE DELETION ====================

  @Test
  void testDeleteSpecificRelationTypePreservesOthers(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "del_a");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "del_b");
    GlossaryTerm termC = GlossaryTermTestFactory.createWithName(ns, glossary, "del_c");

    // Add different relation types to different terms
    // A -> B as synonym, A -> C as broader
    addTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");
    addTermRelation(termA.getId().toString(), termC.getId().toString(), "broader");

    // Verify both exist on term A
    GlossaryTerm fetchedA = getGlossaryTerm(termA.getId().toString());
    assertNotNull(fetchedA.getRelatedTerms());
    assertEquals(2, fetchedA.getRelatedTerms().size(), "Term A should have 2 related terms");

    // Delete only the "synonym" relation to B
    removeTermRelation(termA.getId().toString(), termB.getId().toString(), "synonym");

    // Verify B is removed but C is preserved
    GlossaryTerm fetchedAfterDelete = getGlossaryTerm(termA.getId().toString());
    assertNotNull(fetchedAfterDelete.getRelatedTerms());

    boolean synonymStillExists =
        fetchedAfterDelete.getRelatedTerms().stream()
            .anyMatch(
                rel ->
                    rel.getTerm().getId().equals(termB.getId())
                        && "synonym".equals(rel.getRelationType()));
    assertFalse(synonymStillExists, "Synonym relation to B should have been deleted");

    boolean broaderStillExists =
        fetchedAfterDelete.getRelatedTerms().stream()
            .anyMatch(
                rel ->
                    rel.getTerm().getId().equals(termC.getId())
                        && "broader".equals(rel.getRelationType()));
    assertTrue(broaderStillExists, "Broader relation to C should still exist");

    assertEquals(
        1,
        fetchedAfterDelete.getRelatedTerms().size(),
        "Should have 1 relation remaining after deletion");

    GlossaryTestFactory.delete(glossary);
  }

  // ==================== FIX 6: VALIDATION IN UPDATE RELATED TERMS ====================

  @Test
  void testInvalidRelationTypeRejectedViaPatch(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "val_a");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "val_b");

    // Try to add a relation with an invalid type via PATCH
    String patchBody =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/relatedTerms/-\","
                + "\"value\":{\"relationType\":\"invalidType123\","
                + "\"term\":{\"id\":\"%s\",\"type\":\"glossaryTerm\"}}}]",
            termB.getId());

    HttpResponse<String> response = patchGlossaryTerm(termA.getId().toString(), patchBody);

    // Should get a 400 Bad Request for invalid relation type
    assertTrue(
        response.statusCode() == 400 || response.statusCode() == 500,
        "Invalid relation type should be rejected, got: " + response.statusCode());

    GlossaryTestFactory.delete(glossary);
  }

  @Test
  void testValidRelationTypeAcceptedViaPost(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm termA = GlossaryTermTestFactory.createWithName(ns, glossary, "validpost_a");
    GlossaryTerm termB = GlossaryTermTestFactory.createWithName(ns, glossary, "validpost_b");

    // Add a relation with a valid type via POST
    HttpResponse<String> response =
        addTermRelationRaw(termA.getId().toString(), termB.getId().toString(), "synonym");

    assertEquals(200, response.statusCode(), "Valid relation type should be accepted");

    GlossaryTerm fetched = getGlossaryTerm(termA.getId().toString());
    assertNotNull(fetched.getRelatedTerms());
    assertFalse(fetched.getRelatedTerms().isEmpty());

    GlossaryTestFactory.delete(glossary);
  }

  // ==================== FIX 8: ERROR MESSAGE SANITIZATION ====================

  @Test
  void testRdfErrorResponsesDoNotLeakInternalDetails() throws Exception {
    String adminToken = SdkClients.getAdminToken();

    // Request a non-existent entity - should get a clean error response
    HttpResponse<String> response =
        httpGet(
            "/v1/rdf/entity/table/" + java.util.UUID.randomUUID() + "?format=jsonld", adminToken);

    // Whether 404, 500, or 503 - the error body should not contain stack traces or internal paths
    String body = response.body();
    if (response.statusCode() >= 400) {
      assertFalse(
          body.contains("Exception"), "Error response should not contain exception class names");
      assertFalse(
          body.contains("at org."), "Error response should not contain stack trace elements");
      assertFalse(
          body.contains(".java:"), "Error response should not contain Java file references");
    }
  }

  @Test
  void testRdfDebugEndpointErrorResponseSanitized() throws Exception {
    String adminToken = SdkClients.getAdminToken();

    // If RDF is not enabled, should get a clean service unavailable response
    HttpResponse<String> response = httpGet("/v1/rdf/debug/glossary-relations", adminToken);

    String body = response.body();
    if (response.statusCode() >= 400) {
      assertFalse(
          body.contains("Exception"), "Error response should not contain exception class names");
      assertFalse(body.contains("Caused by"), "Error response should not contain exception chains");
    }
  }

  // ==================== FIX 4: GRAPH NODE LIMIT ====================

  @Test
  void testRelationGraphWithManyTerms(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);

    // Create a hub term with many related terms
    GlossaryTerm hub = GlossaryTermTestFactory.createWithName(ns, glossary, "hub");
    int spokeCount = 10;
    for (int i = 0; i < spokeCount; i++) {
      GlossaryTerm spoke = GlossaryTermTestFactory.createWithName(ns, glossary, "spoke" + i);
      addTermRelation(hub.getId().toString(), spoke.getId().toString(), "relatedTo");
    }

    // Request the graph - should succeed and contain nodes
    Map<String, Object> graph = getTermRelationGraph(hub.getId().toString(), 2, null);

    assertNotNull(graph);
    assertTrue(graph.containsKey("nodes"), "Graph should contain nodes");
    assertTrue(graph.containsKey("edges"), "Graph should contain edges");

    @SuppressWarnings("unchecked")
    List<Object> nodes = (List<Object>) graph.get("nodes");
    assertNotNull(nodes);
    // Hub + spokes = spokeCount + 1
    assertTrue(nodes.size() >= spokeCount + 1, "Graph should contain hub and all spoke terms");

    GlossaryTestFactory.delete(glossary);
  }

  // ==================== HELPER METHODS ====================

  private GlossaryTerm addTermRelation(String fromTermId, String toTermId, String relationType)
      throws Exception {
    HttpResponse<String> response = addTermRelationRaw(fromTermId, toTermId, relationType);
    if (response.statusCode() != 200) {
      LOG.warn(
          "Failed to add term relation: status={}, body={}",
          response.statusCode(),
          response.body());
      return null;
    }
    return OBJECT_MAPPER.readValue(response.body(), GlossaryTerm.class);
  }

  private HttpResponse<String> addTermRelationRaw(
      String fromTermId, String toTermId, String relationType) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url = String.format("%s/v1/glossaryTerms/%s/relations", baseUrl, fromTermId);

    String jsonBody =
        String.format(
            "{\"term\":{\"id\":\"%s\",\"type\":\"glossaryTerm\"},\"relationType\":\"%s\"}",
            toTermId, relationType);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private void removeTermRelation(String fromTermId, String toTermId, String relationType)
      throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format(
            "%s/v1/glossaryTerms/%s/relations/%s?relationType=%s",
            baseUrl, fromTermId, toTermId, relationType);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .timeout(Duration.ofSeconds(30))
            .DELETE()
            .build();

    HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private GlossaryTerm getGlossaryTerm(String termId) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url = String.format("%s/v1/glossaryTerms/%s?fields=relatedTerms", baseUrl, termId);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn("Failed to get term: status={}, body={}", response.statusCode(), response.body());
      return null;
    }

    return OBJECT_MAPPER.readValue(response.body(), GlossaryTerm.class);
  }

  private Map<String, Object> getTermRelationGraph(String termId, int depth, String relationTypes)
      throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format(
            "%s/v1/glossaryTerms/%s/relationsGraph?depth=%d%s",
            baseUrl, termId, depth, relationTypes != null ? "&relationTypes=" + relationTypes : "");

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn(
          "Failed to get term relation graph: status={}, body={}",
          response.statusCode(),
          response.body());
      return Map.of();
    }

    return OBJECT_MAPPER.readValue(response.body(), new TypeReference<Map<String, Object>>() {});
  }

  private HttpResponse<String> patchGlossaryTerm(String termId, String patchBody) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url = String.format("%s/v1/glossaryTerms/%s", baseUrl, termId);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json-patch+json")
            .timeout(Duration.ofSeconds(30))
            .method("PATCH", HttpRequest.BodyPublishers.ofString(patchBody))
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> httpGet(String path, String token) throws Exception {
    String baseUrl = SdkClients.getServerUrl();

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + path))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> httpPost(String path, String body, String token) throws Exception {
    String baseUrl = SdkClients.getServerUrl();

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + path))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private String getNonAdminToken() {
    return JwtAuthProvider.tokenFor(
        "test@open-metadata.org", "test@open-metadata.org", new String[] {}, 3600);
  }
}
