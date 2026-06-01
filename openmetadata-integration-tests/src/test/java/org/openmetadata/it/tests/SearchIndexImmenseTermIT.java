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

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
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
 *   <li><b>Depth:</b> a plain {@code object} mapping grows one mapping level per nesting and blows
 *       past the depth limit (the failure PR #28214 hit). Mapping the recursive {@code children} as
 *       {@code object}/{@code "enabled": false} makes it a terminal mapping node — the subtree is
 *       stored in {@code _source} but never parsed — so arbitrary document depth adds zero mapping
 *       depth, exactly like the previous {@code flattened} mapping.
 *   <li><b>Immense term:</b> {@code flattened} indexed every leaf as one keyword term, so the
 *       oversized leaf failed the whole bulk insert on OpenSearch (no {@code ignore_above} on
 *       {@code flat_object}). {@code enabled:false} indexes no leaf at all, removing the exposure
 *       identically on both engines.
 * </ul>
 *
 * <p>Not engine-gated: the original break reproduces on OpenSearch, and the test also asserts the
 * deeply nested column name stays searchable via the analyzed {@code columnNamesFuzzy} field (built
 * from the full child hierarchy), not the dropped flattened {@code children} field.
 */
@Slf4j
@ExtendWith(TestNamespaceExtension.class)
public class SearchIndexImmenseTermIT {

  private static final String CONTAINER_ASSET_TYPE = "container";
  private static final int LUCENE_MAX_TERM_BYTES = 32766;
  private static final int NESTING_DEPTH = 25;
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  @Test
  void oversizedLeafInDeeplyNestedColumnIndexesAndStaysSearchable(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    // Letters-only token: word_delimiter fragments alphanumeric runs on letter/digit boundaries,
    // so a token carrying RUN_ID hex digits would tokenize inconsistently between the indexed
    // column name and the query. Letters keep the leaf name a single, exactly-matchable term.
    String token = ns.prefix("immense").replaceAll("[^a-zA-Z]", "").toLowerCase();
    String descriptionToken = "immensedesc" + token;
    String leafColumnName = "deepleaf" + token;
    String oversizedLeaf = buildOversizedExpression();
    assertTrue(
        oversizedLeaf.getBytes(StandardCharsets.UTF_8).length > LUCENE_MAX_TERM_BYTES,
        "Fixture must exceed the Lucene term limit to exercise the original failure");

    StorageService service = StorageServiceTestFactory.createS3(ns);
    Column topLevelColumn = buildDeeplyNestedColumn(token, leafColumnName, oversizedLeaf);
    ContainerDataModel dataModel = new ContainerDataModel().withColumns(List.of(topLevelColumn));
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("immense-container"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription(descriptionToken);
    request.setDataModel(dataModel);
    Container container = client.containers().create(request);
    String containerId = container.getId().toString();
    log.info(
        "Created container {} nested {} levels deep with a {}-byte leaf",
        containerId,
        NESTING_DEPTH,
        oversizedLeaf.getBytes(StandardCharsets.UTF_8).length);

    // Plain-object mapping would exceed the depth limit; flattened would fail the oversized leaf
    // (immense term) on OpenSearch. object/enabled:false lets the document index in both respects.
    awaitContainerSearchable(descriptionToken, containerId);

    HttpResponse<String> byDeepColumn = searchContainers(leafColumnName);
    assertEquals(200, byDeepColumn.statusCode(), "Deep nested column-name search must not error");
    assertTrue(
        byDeepColumn.body().contains(containerId),
        "A 25-level-deep column name must remain searchable via columnNamesFuzzy");
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

  private void awaitContainerSearchable(String token, String containerId) {
    Awaitility.await("container indexed in search")
        .atMost(180, TimeUnit.SECONDS)
        .pollInterval(1, TimeUnit.SECONDS)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              HttpResponse<String> response = searchContainers(token);
              assertEquals(200, response.statusCode());
              assertTrue(response.body().contains(containerId));
            });
  }

  private HttpResponse<String> searchContainers(String token) throws Exception {
    String path =
        "/v1/search/query?q="
            + URLEncoder.encode(token, StandardCharsets.UTF_8)
            + "&index="
            + CONTAINER_ASSET_TYPE
            + "&from=0&size=10&deleted=false";
    HttpRequest httpRequest =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();
    return HTTP_CLIENT.send(httpRequest, HttpResponse.BodyHandlers.ofString());
  }
}
