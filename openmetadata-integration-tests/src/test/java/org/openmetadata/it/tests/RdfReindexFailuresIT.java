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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.service.Entity;

/**
 * Contract for {@code GET /v1/rdf/reindex/failures}: the endpoint the RDF app's "View Reindex
 * Failures" drawer reads. Before this endpoint existed the drawer called the search API, so RDF
 * failures were never viewable — these tests pin the envelope shape, the pagination and filter
 * parameters the drawer sends, entity-type validation, and the admin-only gate.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class RdfReindexFailuresIT {

  private static final String FAILURES_PATH = "/v1/rdf/reindex/failures";
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final java.net.http.HttpClient HTTP_CLIENT =
      java.net.http.HttpClient.newHttpClient();

  // dataConsumer JWT authorization resolves the user through SubjectCache; creating it up front
  // keeps the expected 403 deterministic regardless of suite ordering.
  @BeforeAll
  static void ensureDataConsumerUser() {
    UserTestFactory.getDataConsumer(null);
  }

  private static HttpResponse<String> get(String query, String jwt) throws Exception {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder().uri(URI.create(SdkClients.getServerUrl() + FAILURES_PATH + query));
    if (jwt != null) {
      builder.header("Authorization", "Bearer " + jwt);
    }
    return HTTP_CLIENT.send(builder.GET().build(), HttpResponse.BodyHandlers.ofString());
  }

  private static String adminJwt() {
    return SdkClients.getAdminToken();
  }

  private static String dataConsumerJwt() {
    return JwtAuthProvider.tokenFor(
        "data-consumer@open-metadata.org",
        "data-consumer@open-metadata.org",
        new String[] {"DataConsumer"},
        3600);
  }

  private static void assertInvalidEntityTypeResponse(
      HttpResponse<String> response, String entityType) throws Exception {
    assertEquals(400, response.statusCode(), response.body());
    JsonNode body = MAPPER.readTree(response.body());
    assertEquals(400, body.path("code").asInt(), response.body());
    assertEquals(
        "Invalid entityType '%s'. Expected an RDF-indexable entity type.".formatted(entityType),
        body.path("message").asText(),
        response.body());
  }

  @Test
  void listFailures_admin_returnsPaginatedEnvelope() throws Exception {
    HttpResponse<String> response = get("?limit=10&offset=0", adminJwt());

    assertEquals(200, response.statusCode(), response.body());
    JsonNode body = MAPPER.readTree(response.body());
    assertNotNull(body.get("data"), "envelope must carry a data array");
    assertTrue(body.get("data").isArray());
    assertEquals(10, body.get("limit").asInt());
    assertEquals(0, body.get("offset").asInt());
    assertTrue(body.get("total").asInt() >= 0);
    // The drawer pages on `total`; a page can never carry more rows than its limit,
    // and when everything fits on one page the two must agree.
    assertTrue(body.get("data").size() <= 10);
    if (body.get("total").asInt() <= 10) {
      assertEquals(body.get("total").asInt(), body.get("data").size());
    }
  }

  @Test
  void listFailures_unknownEntityType_returns400() throws Exception {
    HttpResponse<String> response = get("?entityType=notAnEntityType", adminJwt());

    assertInvalidEntityTypeResponse(response, "notAnEntityType");
  }

  @Test
  void listFailures_registeredRdfEntityType_isAcceptedAfterTrimming() throws Exception {
    HttpResponse<String> response = get("?entityType=%20" + Entity.TABLE + "%20", adminJwt());

    assertEquals(200, response.statusCode(), response.body());
    assertNotNull(MAPPER.readTree(response.body()).get("data"));
  }

  @Test
  void listFailures_registeredTimeSeriesEntityType_returns400() throws Exception {
    HttpResponse<String> response = get("?entityType=" + Entity.QUERY_COST_RECORD, adminJwt());

    assertInvalidEntityTypeResponse(response, Entity.QUERY_COST_RECORD);
  }

  @Test
  void listFailures_blankEntityType_isTreatedAsNoFilter() throws Exception {
    HttpResponse<String> response = get("?entityType=%20%20%20", adminJwt());

    assertEquals(200, response.statusCode(), response.body());
    JsonNode body = MAPPER.readTree(response.body());
    assertNotNull(body.get("data"));
    assertTrue(body.get("total").asInt() >= 0);
  }

  @Test
  void listFailures_defaultsApplyWhenParametersOmitted() throws Exception {
    HttpResponse<String> response = get("", adminJwt());

    assertEquals(200, response.statusCode(), response.body());
    JsonNode body = MAPPER.readTree(response.body());
    assertEquals(50, body.get("limit").asInt(), "default page size");
    assertEquals(0, body.get("offset").asInt(), "default offset");
  }

  @Test
  void listFailures_noAuth_returns401() throws Exception {
    assertEquals(401, get("", null).statusCode());
  }

  @Test
  void listFailures_dataConsumer_returns403() throws Exception {
    assertEquals(403, get("", dataConsumerJwt()).statusCode());
  }
}
