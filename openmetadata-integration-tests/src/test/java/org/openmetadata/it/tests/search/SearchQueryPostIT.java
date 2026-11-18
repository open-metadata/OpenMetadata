/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Verifies the POST {@code /v1/search/query} variant added alongside the existing GET, so large
 * query filters (e.g. a metric's {@code ids} filter carrying hundreds of linked asset ids) do not
 * have to travel in the request line.
 *
 * <p>Specifically asserts:
 *
 * <ol>
 *   <li>POST accepts a {@link org.openmetadata.schema.search.SearchRequest} JSON body and returns
 *       a 200 with the same {@code SearchResponse} shape as GET (hits + aggregations).
 *   <li>POST rejects negative {@code from}/{@code size} with a 400 and a message that matches the
 *       GET / preview contract, before the search backend is touched.
 *   <li>POST accepts a {@code queryFilter} whose serialized form is far larger than the server's
 *       8 KiB request-line cap and still returns 200; the same filter sent as a GET
 *       {@code query_filter} query param exceeds the request-line limit and fails (the original
 *       bug). This is the end-to-end artifact of the bug fix.
 * </ol>
 */
@ExtendWith(TestNamespaceExtension.class)
class SearchQueryPostIT {

  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final ObjectMapper MAPPER = JsonUtils.getObjectMapper();
  private static final String SEARCH_QUERY_PATH = "/v1/search/query";
  private static final String TABLE_INDEX = "table";
  private static final String QUERY = "query";
  private static final String INDEX = "index";
  private static final String FROM = "from";
  private static final String SIZE = "size";
  private static final String QUERY_FILTER = "queryFilter";
  private static final String HITS = "hits";
  private static final String TOTAL = "total";
  private static final String AGGREGATIONS = "aggregations";
  private static final String APPLICATION_JSON = "application/json";

  @Test
  void postSearchQueryReturnsSearchResponse(final TestNamespace ns) throws Exception {
    // A trivial ids filter that matches nothing real; we only assert the shape and a 200.
    final ObjectNode body = searchBody(0, 5);
    body.put(QUERY_FILTER, "{\"query\":{\"bool\":{\"must\":[{\"ids\":{\"values\":[]}}]}}}");

    final HttpResponse<String> response = postSearchQuery(body);

    assertEquals(
        200,
        response.statusCode(),
        "POST /v1/search/query must return 200 for a trivial filter. body=" + response.body());

    final JsonNode json = MAPPER.readTree(response.body());
    assertTrue(json.has(HITS), "response must carry `hits` (SearchResponse shape)");
    assertTrue(json.path(HITS).has(TOTAL), "hits.total must be present");
    // aggregations may be a present-but-null key when includeAggregations defaults; assert the
    // key exists at least, matching the GET contract documented by the search listeners.
    assertTrue(
        json.has(AGGREGATIONS) || json.path(AGGREGATIONS).isNull(),
        "response must carry `aggregations`");
  }

  @Test
  void postSearchQueryRejectsNegativePagination(final TestNamespace ns) throws Exception {
    final ObjectNode body = searchBody(-1, 10);

    final HttpResponse<String> response = postSearchQuery(body);

    assertEquals(
        400,
        response.statusCode(),
        "POST /v1/search/query must reject from<0 with 400. body=" + response.body());
    assertTrue(
        response.body().contains("from must be greater than or equal to 0"),
        "error message must name the rejected field. body=" + response.body());

    final ObjectNode sizeBody = searchBody(0, -1);

    final HttpResponse<String> sizeResponse = postSearchQuery(sizeBody);
    assertEquals(
        400,
        sizeResponse.statusCode(),
        "POST /v1/search/query must reject size<0 with 400. body=" + sizeResponse.body());
    assertTrue(
        sizeResponse.body().contains("size must be greater than or equal to 0"),
        "error message must name the rejected field. body=" + sizeResponse.body());
  }

  /**
   * The bug this whole fix is built around: a metric Assets tab embeds every linked asset id in
   * an {@code ids} filter. 500+ UUIDs serialized into a GET {@code query_filter} query param blow
   * past the 8 KiB request-line cap and the request fails. The body-carried POST carries the exact
   * same filter without ever touching the request-line limit — so this is the canary that
   * demonstrates the bug is fixed end-to-end against a real search backend.
   */
  @Test
  void postSearchQueryAcceptsIdsFilterTooLargeForGet(final TestNamespace ns) throws Exception {
    // ~500 random UUIDs serializes to ~22 KB of URL-encoded JSON, well past the 8 KiB cap.
    final ArrayNode ids = MAPPER.createArrayNode();
    for (int i = 0; i < 500; i++) {
      ids.add(UUID.randomUUID().toString());
    }
    final ObjectNode filter = MAPPER.createObjectNode();
    final ObjectNode bool = MAPPER.createObjectNode();
    final ObjectNode idsClause = MAPPER.createObjectNode();
    idsClause.set("values", ids);
    bool.set("must", MAPPER.createArrayNode().add(MAPPER.createObjectNode().set("ids", idsClause)));
    filter.set(QUERY, MAPPER.createObjectNode().set("bool", bool));
    final String queryFilter = MAPPER.writeValueAsString(filter);

    final ObjectNode body = searchBody(0, 10);
    body.put(QUERY_FILTER, queryFilter);

    final HttpResponse<String> postResponse = postSearchQuery(body);
    assertEquals(
        200,
        postResponse.statusCode(),
        "POST must accept the over-8KiB filter in the body. body=" + postResponse.body());

    final JsonNode json = MAPPER.readTree(postResponse.body());
    assertTrue(json.has(HITS), "POST must return SearchResponse shape, not 414/400/431");
    // The filter lists non-existent ids, so the matched hit count is 0 — but the response must
    // still be a well-formed SearchResponse, not a 414/400/431.
    assertEquals(0, json.path(HITS).path(TOTAL).path("value").asInt(-1));

    // The same filter via GET must fail — that's the bug, and the existence of the POST variant
    // is the fix. The endpoint returns 414 (Jetty Request-URI Too Long), or 400/431 depending on
    // the fronting proxy; the only acceptable outcomes here are 4xx that are NOT 200.
    final String getUrl =
        SEARCH_QUERY_PATH
            + "?q=*&index="
            + TABLE_INDEX
            + "&from=0&size=10&deleted=false&query_filter="
            + URLEncoder.encode(queryFilter, StandardCharsets.UTF_8);
    final HttpResponse<String> getResponse = httpGet(getUrl);
    assertTrue(
        getResponse.statusCode() >= 400 && getResponse.statusCode() < 500,
        "The over-sized GET must fail with 4xx (the original bug). status="
            + getResponse.statusCode()
            + " body="
            + getResponse.body());
    assertFalse(
        getResponse.statusCode() == 200,
        "If the over-sized GET returned 200, the bug would not be reproduced; the test would be"
            + " silently green without exercising the fix.");
  }

  private static ObjectNode searchBody(final int from, final int size) {
    final ObjectNode body = MAPPER.createObjectNode();
    body.put(QUERY, "*");
    body.put(INDEX, TABLE_INDEX);
    body.put(FROM, from);
    body.put(SIZE, size);
    return body;
  }

  private HttpResponse<String> postSearchQuery(final JsonNode body) throws Exception {
    final HttpRequest request =
        baseRequest(SEARCH_QUERY_PATH)
            .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(body)))
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> httpGet(final String path) throws Exception {
    return HTTP_CLIENT.send(baseRequest(path).GET().build(), HttpResponse.BodyHandlers.ofString());
  }

  private HttpRequest.Builder baseRequest(final String path) {
    return HttpRequest.newBuilder()
        .uri(URI.create(SdkClients.getServerUrl() + path))
        .header("Authorization", "Bearer " + SdkClients.getAdminToken())
        .header("Content-Type", APPLICATION_JSON)
        .header("Accept", APPLICATION_JSON)
        .timeout(Duration.ofSeconds(30));
  }
}
