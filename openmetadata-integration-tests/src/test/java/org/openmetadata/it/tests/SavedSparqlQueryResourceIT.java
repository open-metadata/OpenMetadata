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

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.rdf.SavedSparqlQueries;
import org.openmetadata.schema.api.rdf.SavedSparqlQuery;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class SavedSparqlQueryResourceIT {
  private static final String SAVED_QUERY_PATH = "/v1/rdf/queries/saved";
  private static final String PRIVATE_DOCUMENT_TYPE = "SparqlQuery";
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

  @Test
  void persistsPerUserQueriesWithoutExposingPrivateDocuments(TestNamespace namespace)
      throws Exception {
    final User owner = createUser(namespace, "query-owner");
    final User otherUser = createUser(namespace, "query-other");
    final String ownerToken = token(owner);
    final String otherToken = token(otherUser);
    final SavedSparqlQueries expected = library();

    final HttpResponse<String> update = put(SAVED_QUERY_PATH, ownerToken, expected);
    final HttpResponse<String> ownerRead = get(SAVED_QUERY_PATH, ownerToken);
    final HttpResponse<String> otherRead = get(SAVED_QUERY_PATH, otherToken);

    assertEquals(200, update.statusCode());
    assertEquals(expected, JsonUtils.readValue(update.body(), SavedSparqlQueries.class));
    assertEquals(expected, JsonUtils.readValue(ownerRead.body(), SavedSparqlQueries.class));
    assertEquals(
        List.of(), JsonUtils.readValue(otherRead.body(), SavedSparqlQueries.class).getQueries());
    assertGenericDocumentApiCannotExpose(owner);
  }

  private static void assertGenericDocumentApiCannotExpose(final User owner) throws Exception {
    final String adminToken = SdkClients.getAdminToken();
    final HttpResponse<String> filteredList =
        get("/v1/docStore?entityType=" + PRIVATE_DOCUMENT_TYPE, adminToken);
    final HttpResponse<String> unfilteredList = get("/v1/docStore?limit=1000000", adminToken);
    final String documentFqn = PRIVATE_DOCUMENT_TYPE + "." + owner.getId();
    final HttpResponse<String> directRead =
        get("/v1/docStore/name/" + encode(documentFqn), adminToken);

    assertEquals(404, filteredList.statusCode());
    assertEquals(404, directRead.statusCode());
    assertEquals(200, unfilteredList.statusCode());
    assertFalse(unfilteredList.body().contains(documentFqn));
  }

  private static SavedSparqlQueries library() {
    final SavedSparqlQuery query =
        new SavedSparqlQuery()
            .withId(UUID.randomUUID())
            .withName("Owned query")
            .withQuery("SELECT ?term WHERE { ?term a <urn:GlossaryTerm> }")
            .withFormat(SavedSparqlQuery.Format.JSON)
            .withInference(SavedSparqlQuery.Inference.NONE)
            .withSavedAt(System.currentTimeMillis());
    return new SavedSparqlQueries().withQueries(List.of(query));
  }

  private static User createUser(final TestNamespace namespace, final String suffix) {
    final String name =
        (suffix + "-" + UUID.randomUUID().toString().substring(0, 8)).toLowerCase(Locale.ROOT);
    final String email = name + "@test.openmetadata.org";
    final CreateUser request = new CreateUser().withName(name).withEmail(email).withIsBot(false);
    return SdkClients.adminClient().users().create(request);
  }

  private static String token(final User user) {
    return JwtAuthProvider.tokenFor(user.getEmail(), user.getEmail(), new String[] {}, 3600);
  }

  private static HttpResponse<String> put(
      final String path, final String token, final SavedSparqlQueries savedQueries)
      throws Exception {
    final HttpRequest request =
        request(path, token)
            .PUT(HttpRequest.BodyPublishers.ofString(JsonUtils.pojoToJson(savedQueries)))
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static HttpResponse<String> get(final String path, final String token) throws Exception {
    final HttpRequest request = request(path, token).GET().build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static HttpRequest.Builder request(final String path, final String token) {
    return HttpRequest.newBuilder()
        .uri(URI.create(SdkClients.getServerUrl() + path))
        .header("Authorization", "Bearer " + token)
        .header("Content-Type", "application/json")
        .timeout(Duration.ofSeconds(30));
  }

  private static String encode(final String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
