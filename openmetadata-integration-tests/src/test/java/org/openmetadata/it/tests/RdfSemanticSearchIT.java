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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.service.rdf.RdfUpdater;

/**
 * Integration tests for the RDF semantic-search endpoints exposed by {@code RdfResource}:
 *
 * <ul>
 *   <li>{@code GET /v1/rdf/search/semantic}
 *   <li>{@code GET /v1/rdf/search/similar/{entityType}/{id}}
 *   <li>{@code GET /v1/rdf/search/recommendations/{userId}}
 * </ul>
 *
 * <p>All three are admin-only ({@code authorizer.authorizeAdmin}) and require the RDF repository to
 * be enabled (otherwise the resource throws {@link jakarta.ws.rs.ServiceUnavailableException}, 503).
 * The class runs only under the RDF test profile and initializes the in-process Fuseki-backed
 * repository, mirroring {@code RdfResourceIT}.
 *
 * <p>Test isolation: {@link TestNamespace} for unique entity naming; {@link Isolated} because the
 * class toggles the process-wide RDF repository singleton via {@link RdfUpdater}.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class RdfSemanticSearchIT {

  private static final String BASE_URI = "https://open-metadata.org/";
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  private static final ObjectMapper MAPPER = new ObjectMapper();

  @BeforeAll
  static void enableRdf() {
    assumeTrue(
        RdfTestUtils.isRdfEnabled(),
        "RDF is disabled for this test run. Use the RDF test profile to execute RdfSemanticSearchIT.");
    RdfConfiguration rdfConfig = new RdfConfiguration();
    rdfConfig.setEnabled(true);
    rdfConfig.setBaseUri(URI.create(BASE_URI));
    rdfConfig.setStorageType(RdfConfiguration.StorageType.FUSEKI);
    rdfConfig.setRemoteEndpoint(URI.create(TestSuiteBootstrap.getFusekiEndpoint()));
    rdfConfig.setUsername("admin");
    rdfConfig.setPassword("test-admin");
    rdfConfig.setDataset("openmetadata");
    RdfUpdater.initialize(rdfConfig);
  }

  @AfterAll
  static void disableRdf() {
    RdfUpdater.disable();
  }

  @AfterEach
  void cleanup(TestNamespace ns) {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
  }

  // ---------------------------------------------------------------------------
  // semantic search
  // ---------------------------------------------------------------------------

  @Test
  void semanticSearchReturnsRankedResultsWithinLimit(TestNamespace ns) throws Exception {
    createTable(ns, "semanticRankedTable");
    int limit = 5;
    HttpResponse<String> response =
        get(
            "/v1/rdf/search/semantic?q=" + encode("table") + "&type=table&limit=" + limit,
            SdkClients.getAdminToken());

    assertEquals(200, response.statusCode(), response.body());
    JsonNode results = assertJsonArray(response.body());
    assertTrue(
        results.size() <= limit,
        "semantic search must honor the limit parameter, got " + results.size());
    assertScoresNonIncreasing(results);
  }

  @Test
  void semanticSearchWithoutTypeFilterReturnsArray() throws Exception {
    HttpResponse<String> response =
        get("/v1/rdf/search/semantic?q=" + encode("customer data"), SdkClients.getAdminToken());

    assertEquals(200, response.statusCode(), response.body());
    assertJsonArray(response.body());
  }

  @Test
  void semanticSearchBlankQueryReturnsBadRequest() throws Exception {
    HttpResponse<String> response =
        get("/v1/rdf/search/semantic?q=&type=table", SdkClients.getAdminToken());

    assertEquals(
        400,
        response.statusCode(),
        "blank q must fail @NotEmpty validation with 400: " + response.body());
  }

  @Test
  void semanticSearchNonAdminForbidden(TestNamespace ns) throws Exception {
    HttpResponse<String> response =
        get("/v1/rdf/search/semantic?q=" + encode("table"), nonAdminToken(ns, "semanticNoAdmin"));

    assertEquals(
        403,
        response.statusCode(),
        "semantic search is admin-only and must reject non-admins: " + response.body());
  }

  // ---------------------------------------------------------------------------
  // similar entities
  // ---------------------------------------------------------------------------

  @Test
  void findSimilarReturnsArrayForExistingEntity(TestNamespace ns) throws Exception {
    Table table = createTable(ns, "similarSeedTable");
    int limit = 8;
    HttpResponse<String> response =
        get(
            "/v1/rdf/search/similar/table/" + table.getId() + "?limit=" + limit,
            SdkClients.getAdminToken());

    assertEquals(200, response.statusCode(), response.body());
    JsonNode results = assertJsonArray(response.body());
    assertTrue(
        results.size() <= limit,
        "similar search must honor the limit parameter, got " + results.size());
    assertSeedEntityExcluded(results, table.getId());
  }

  /**
   * The resource documents 404 for a missing entity, but {@code SemanticSearchEngine
   * .findSimilarEntities} catches every exception (including {@code EntityNotFoundException}) and
   * returns an empty list, so the endpoint answers 200 with an empty array. This test pins the
   * actual behavior; see the manifest note for the doc/impl mismatch.
   */
  @Test
  void findSimilarMissingEntityReturnsEmptyResults() throws Exception {
    HttpResponse<String> response =
        get("/v1/rdf/search/similar/table/" + UUID.randomUUID(), SdkClients.getAdminToken());

    assertEquals(200, response.statusCode(), response.body());
    JsonNode results = assertJsonArray(response.body());
    assertEquals(0, results.size(), "missing entity yields no similar results: " + response.body());
  }

  @Test
  void findSimilarNonAdminForbidden(TestNamespace ns) throws Exception {
    HttpResponse<String> response =
        get(
            "/v1/rdf/search/similar/table/" + UUID.randomUUID(),
            nonAdminToken(ns, "similarNoAdmin"));

    assertEquals(
        403,
        response.statusCode(),
        "similar search is admin-only and must reject non-admins: " + response.body());
  }

  // ---------------------------------------------------------------------------
  // recommendations
  // ---------------------------------------------------------------------------

  @Test
  void getRecommendationsReturnsArrayForUser(TestNamespace ns) throws Exception {
    User user = UserTestFactory.createUser(ns, "recommendationUser");
    int limit = 6;
    HttpResponse<String> response =
        get(
            "/v1/rdf/search/recommendations/" + user.getId() + "?limit=" + limit,
            SdkClients.getAdminToken());

    assertEquals(200, response.statusCode(), response.body());
    JsonNode results = assertJsonArray(response.body());
    assertTrue(
        results.size() <= limit,
        "recommendations must honor the limit parameter, got " + results.size());
  }

  /**
   * As with {@link #findSimilarMissingEntityReturnsEmptyResults}, the resource documents 404 for a
   * missing user but {@code SemanticSearchEngine.getRecommendations} swallows all exceptions and
   * returns an empty list, so the endpoint answers 200 with an empty array.
   */
  @Test
  void getRecommendationsMissingUserReturnsEmptyResults() throws Exception {
    HttpResponse<String> response =
        get("/v1/rdf/search/recommendations/" + UUID.randomUUID(), SdkClients.getAdminToken());

    assertEquals(200, response.statusCode(), response.body());
    JsonNode results = assertJsonArray(response.body());
    assertEquals(0, results.size(), "missing user yields no recommendations: " + response.body());
  }

  @Test
  void getRecommendationsNonAdminForbidden(TestNamespace ns) throws Exception {
    HttpResponse<String> response =
        get(
            "/v1/rdf/search/recommendations/" + UUID.randomUUID(),
            nonAdminToken(ns, "recommendationNoAdmin"));

    assertEquals(
        403,
        response.statusCode(),
        "recommendations is admin-only and must reject non-admins: " + response.body());
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  private Table createTable(TestNamespace ns, String baseName) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix(baseName));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setDescription("Semantic search fixture table");
    createRequest.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build()));
    return Tables.create(createRequest);
  }

  private String nonAdminToken(TestNamespace ns, String baseName) {
    User nonAdmin = UserTestFactory.createUser(ns, baseName);
    return JwtAuthProvider.tokenFor(
        nonAdmin.getEmail(), nonAdmin.getEmail(), new String[] {}, 3600);
  }

  private HttpResponse<String> get(String path, String token) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private JsonNode assertJsonArray(String body) throws Exception {
    JsonNode node = MAPPER.readTree(body);
    assertTrue(node.isArray(), "response body must be a JSON array: " + body);
    return node;
  }

  private void assertScoresNonIncreasing(JsonNode results) {
    double previous = Double.MAX_VALUE;
    for (JsonNode result : results) {
      JsonNode scoreNode = result.get("score");
      if (scoreNode != null && scoreNode.isNumber()) {
        double score = scoreNode.asDouble();
        assertTrue(
            score <= previous,
            "results must be ranked by descending score, saw " + score + " after " + previous);
        previous = score;
      }
    }
  }

  private void assertSeedEntityExcluded(JsonNode results, UUID seedId) {
    for (JsonNode result : results) {
      JsonNode entity = result.get("entity");
      if (entity != null && entity.hasNonNull("id")) {
        assertTrue(
            !seedId.toString().equals(entity.get("id").asText()),
            "similar search must exclude the seed entity itself");
      }
    }
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
