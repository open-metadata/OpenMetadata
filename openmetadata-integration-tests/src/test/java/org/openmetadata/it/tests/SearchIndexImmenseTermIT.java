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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Regression guard for the two failures that drove the recursive {@code children} mapping change,
 * exercised together in one worst-case fixture: a struct sub-column nested 25 levels deep (past the
 * default {@code index.mapping.depth.limit} of 20) whose leaf description exceeds Lucene's per-term
 * limit (32,766 bytes) — e.g. a ~50 KB Looker/DAX expression.
 *
 * <ul>
 *   <li><b>Indexing never fails:</b> mapping the recursive {@code children} as {@code object}/{@code
 *       "enabled": false} makes it a terminal mapping node — the subtree is stored in {@code _source}
 *       but never parsed — so arbitrary document depth adds zero mapping depth and the oversized leaf
 *       is never indexed as a keyword term. The container always indexes on both engines.
 *   <li><b>Column-name searchability is bounded by the configured depth and is tunable:</b> the
 *       analyzed {@code columnNamesFuzzy} field is built from the flattened column hierarchy, capped
 *       at the depth limit. With the default 20 a 25-level leaf name is dropped; after raising the
 *       limit through the admin search-index-mappings API, a container indexed afterwards carries the
 *       deep leaf name. The assertion is on the indexed {@code columnNamesFuzzy} value (deterministic
 *       given the depth), not on a fuzzy query match (whose relevance/refresh timing is unrelated to
 *       the depth being exercised here).
 * </ul>
 */
@Slf4j
@ExtendWith(TestNamespaceExtension.class)
public class SearchIndexImmenseTermIT {

  private static final String CONTAINER_ASSET_TYPE = "container";
  private static final String MAPPING_LANGUAGE = "en";
  private static final int LUCENE_MAX_TERM_BYTES = 32766;
  private static final int NESTING_DEPTH = 25;
  private static final int RAISED_DEPTH_LIMIT = NESTING_DEPTH + 5;
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private record NestedContainer(
      String containerId, String leafColumnName, String descriptionToken) {}

  @Test
  void deepColumnSearchabilityFollowsConfiguredDepthLimit(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Default depth limit (20): the container indexes despite the >32 KB leaf, but the
    // 25-level-deep
    // column name is dropped from the flattened columnNamesFuzzy.
    NestedContainer withDefault = createDeeplyNestedContainer(ns, client, service, "depthdefault");
    awaitContainerSearchable(withDefault.descriptionToken(), withDefault.containerId());
    assertFalse(
        indexedColumnNamesFuzzy(withDefault).contains(withDefault.leafColumnName()),
        "With the default depth limit the 25-level-deep column name must be dropped");

    // Raise the container index depth limit past the nesting depth via the admin mappings API.
    raiseContainerDepthLimit(RAISED_DEPTH_LIMIT);

    // A container indexed after the increase carries the deep column name in columnNamesFuzzy.
    NestedContainer withRaised = createDeeplyNestedContainer(ns, client, service, "depthraised");
    awaitContainerSearchable(withRaised.descriptionToken(), withRaised.containerId());
    assertTrue(
        indexedColumnNamesFuzzy(withRaised).contains(withRaised.leafColumnName()),
        "After raising the depth limit the 25-level-deep column name must be indexed");
  }

  private NestedContainer createDeeplyNestedContainer(
      TestNamespace ns, OpenMetadataClient client, StorageService service, String label)
      throws Exception {
    // Short, letters-only token: keeps the leaf name a single exactly-matchable term and keeps
    // columnNamesFuzzy small enough to index and refresh promptly.
    String token =
        "imm"
            + (UUID.randomUUID() + UUID.randomUUID().toString())
                .replaceAll("[^a-f]", "")
                .substring(0, 10);
    String descriptionToken = label + token;
    String leafColumnName = "deepleaf" + token;
    String oversizedLeaf = buildOversizedExpression();
    assertTrue(
        oversizedLeaf.getBytes(StandardCharsets.UTF_8).length > LUCENE_MAX_TERM_BYTES,
        "Fixture must exceed the Lucene term limit to exercise the original failure");

    Column topLevelColumn = buildDeeplyNestedColumn(token, leafColumnName, oversizedLeaf);
    ContainerDataModel dataModel = new ContainerDataModel().withColumns(List.of(topLevelColumn));
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix(label + "-container"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription(descriptionToken);
    request.setDataModel(dataModel);
    Container container = client.containers().create(request);
    log.info(
        "Created container {} nested {} levels deep with a {}-byte leaf",
        container.getId(),
        NESTING_DEPTH,
        oversizedLeaf.getBytes(StandardCharsets.UTF_8).length);
    return new NestedContainer(container.getId().toString(), leafColumnName, descriptionToken);
  }

  private Column buildDeeplyNestedColumn(
      String token, String leafColumnName, String oversizedLeaf) {
    Column nested =
        new Column()
            .withName(leafColumnName)
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(256)
            .withDescription(oversizedLeaf);
    for (int level = NESTING_DEPTH; level >= 1; level--) {
      nested =
          new Column()
              .withName("lvl" + level + "_" + token)
              .withDataType(ColumnDataType.STRUCT)
              .withChildren(List.of(nested));
    }
    return nested;
  }

  private static String buildOversizedExpression() {
    String unit = "Expression : SUM(CASE WHEN revenue > 0 THEN revenue END) 収益 / ";
    int unitBytes = unit.getBytes(StandardCharsets.UTF_8).length;
    int targetBytes = LUCENE_MAX_TERM_BYTES + 20_000;
    StringBuilder builder = new StringBuilder();
    for (int bytes = 0; bytes < targetBytes; bytes += unitBytes) {
      builder.append(unit);
    }
    return builder.toString();
  }

  /**
   * Raises {@code settings.index.mapping.depth.limit} on the stored {@code container} mapping via the
   * admin search-index-mappings API, leaving every other field intact. The change takes effect for
   * containers indexed afterwards (the per-entity field limits are re-read once the setting cache is
   * invalidated by the update).
   */
  private void raiseContainerDepthLimit(int newDepthLimit) throws Exception {
    HttpResponse<String> current =
        adminRequest(
            "GET",
            "/v1/system/settings/searchIndexMappings/"
                + MAPPING_LANGUAGE
                + "/"
                + CONTAINER_ASSET_TYPE
                + "?fallback=true",
            null);
    assertEquals(200, current.statusCode(), "Fetching the container mapping must succeed");

    ObjectNode mapping = (ObjectNode) MAPPER.readTree(current.body());
    ObjectNode depth =
        objectChild(
            objectChild(objectChild(objectChild(mapping, "settings"), "index"), "mapping"),
            "depth");
    depth.put("limit", newDepthLimit);

    HttpResponse<String> updated =
        adminRequest(
            "PUT",
            "/v1/system/settings/searchIndexMappings/"
                + MAPPING_LANGUAGE
                + "/"
                + CONTAINER_ASSET_TYPE,
            MAPPER.writeValueAsString(mapping));
    assertEquals(200, updated.statusCode(), "Updating the container mapping must succeed");
  }

  private static ObjectNode objectChild(ObjectNode parent, String field) {
    ObjectNode result;
    if (parent.get(field) instanceof ObjectNode existing) {
      result = existing;
    } else {
      result = parent.putObject(field);
    }
    return result;
  }

  private void awaitContainerSearchable(String token, String containerId) {
    Awaitility.await("container indexed in search")
        .atMost(180, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .ignoreExceptions()
        .untilAsserted(() -> assertTrue(searchContainers(token).body().contains(containerId)));
  }

  /** The indexed {@code columnNamesFuzzy} of the container, located by its unique description. */
  private String indexedColumnNamesFuzzy(NestedContainer c) throws Exception {
    JsonNode root = MAPPER.readTree(searchContainers(c.descriptionToken()).body());
    String result = "";
    for (JsonNode hit : root.path("hits").path("hits")) {
      if (c.containerId().equals(hit.path("_source").path("id").asText())) {
        result = hit.path("_source").path("columnNamesFuzzy").asText();
      }
    }
    return result;
  }

  private HttpResponse<String> searchContainers(String token) throws Exception {
    String path =
        "/v1/search/query?q="
            + URLEncoder.encode(token, StandardCharsets.UTF_8)
            + "&index="
            + CONTAINER_ASSET_TYPE
            + "&from=0&size=10&deleted=false";
    return adminRequest("GET", path, null);
  }

  private HttpResponse<String> adminRequest(String method, String path, String body)
      throws Exception {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30));
    if ("PUT".equals(method)) {
      builder.PUT(HttpRequest.BodyPublishers.ofString(body));
    } else {
      builder.GET();
    }
    return HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
  }
}
