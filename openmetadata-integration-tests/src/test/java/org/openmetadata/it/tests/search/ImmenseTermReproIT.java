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
package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.search.SearchFieldLimits;
import org.openmetadata.service.search.SearchIndexSettings;
import org.openmetadata.service.search.opensearch.OsUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Reproduces the production "immense term" reindex failures (SPG-DEV / crocs) against a real
 * OpenSearch node and proves the fix. The custom-property value that triggered the incidents lands in
 * two indexed fields:
 *
 * <ul>
 *   <li>{@code customPropertiesTyped.stringValue} — a nested {@code keyword}. Fixed by {@code
 *       ignore_above} (added by {@link SearchIndexSettings#harden}).
 *   <li>{@code extension} — formerly {@code flattened}/{@code flat_object}, which OpenSearch cannot
 *       guard with {@code ignore_above}. Fixed by making it {@code object, enabled:false} (stored,
 *       not indexed), mirroring the {@code columns.children} fix.
 * </ul>
 *
 * The end-to-end test loads the real table mapping, hardens it, transforms it for OpenSearch and
 * confirms the oversized document is accepted.
 */
class ImmenseTermReproIT {

  private static final Logger LOG = LoggerFactory.getLogger(ImmenseTermReproIT.class);

  private static final String OVERSIZED = "a".repeat(70000); // > 32766 byte Lucene term limit
  private static final HttpClient HTTP = HttpClient.newHttpClient();

  private static String baseUrl;

  private final String suffix = "_" + UUID.randomUUID().toString().replace("-", "");
  private final List<String> created = new ArrayList<>();

  @BeforeAll
  static void useOpenSearch() {
    assumeTrue(
        "opensearch".equalsIgnoreCase(System.getProperty("searchType", "elasticsearch")),
        "needs the OpenSearch client");
    baseUrl =
        "http://" + TestSuiteBootstrap.getSearchHost() + ":" + TestSuiteBootstrap.getSearchPort();
  }

  @AfterEach
  void dropIndices() throws Exception {
    for (String index : created) {
      send("DELETE", "/" + index, null);
    }
  }

  @Test
  void customPropertiesTyped_keyword_reproducesImmenseTerm_andHardeningFixesIt() throws Exception {
    String rawMapping =
        "{\"mappings\":{\"properties\":{\"customPropertiesTyped\":{\"type\":\"nested\","
            + "\"properties\":{\"stringValue\":{\"type\":\"keyword\"}}}}}}";
    String doc = "{\"customPropertiesTyped\":[{\"stringValue\":\"" + OVERSIZED + "\"}]}";

    assertImmenseTerm(indexInto("cpt_raw", rawMapping, doc));

    String hardened = OsUtils.enrichIndexMappingForOpenSearch(harden(rawMapping));
    assertEquals(
        201, indexInto("cpt_fixed", hardened, doc).statusCode(), "ignore_above must accept");
  }

  @Test
  void extension_flatObject_reproducesImmenseTerm_andObjectEnabledFalseFixesIt() throws Exception {
    String doc = "{\"extension\":{\"BodyType\":\"" + OVERSIZED + "\"}}";

    String flatObject =
        "{\"mappings\":{\"properties\":{\"extension\":{\"type\":\"flat_object\"}}}}";
    assertImmenseTerm(indexInto("ext_raw", flatObject, doc));

    String objectDisabled =
        "{\"mappings\":{\"properties\":{\"extension\":{\"type\":\"object\",\"enabled\":false}}}}";
    assertEquals(
        201,
        indexInto("ext_fixed", objectDisabled, doc).statusCode(),
        "object/enabled:false must accept");
  }

  @Test
  void endToEnd_realTableMapping_hardened_acceptsOversizedDocument() throws Exception {
    String raw;
    try (InputStream is =
        getClass()
            .getClassLoader()
            .getResourceAsStream("elasticsearch/en/table_index_mapping.json")) {
      raw = new String(is.readAllBytes(), StandardCharsets.UTF_8);
    }
    String osMapping = OsUtils.enrichIndexMappingForOpenSearch(harden(raw));

    String doc =
        "{\"customPropertiesTyped\":[{\"name\":\"BodyType\",\"stringValue\":\""
            + OVERSIZED
            + "\"}],\"extension\":{\"BodyType\":\""
            + OVERSIZED
            + "\"}}";
    HttpResponse<String> docResponse = indexInto("endtoend_table", osMapping, doc);

    LOG.info("END-TO-END oversized doc: [{}]", docResponse.statusCode());
    assertEquals(
        201, docResponse.statusCode(), "real hardened mapping must accept the oversized doc");
  }

  private String harden(String mapping) {
    return SearchIndexSettings.harden(mapping, SearchFieldLimits.defaults());
  }

  private void assertImmenseTerm(HttpResponse<String> response) {
    assertEquals(400, response.statusCode(), "engine must reject the oversized document");
    assertTrue(
        response.body().contains("immense term") || response.body().contains("max length 32766"),
        "rejection must be the Lucene immense-term error, got: " + response.body());
  }

  private HttpResponse<String> indexInto(String name, String mapping, String doc) throws Exception {
    String index = name + suffix;
    created.add(index);
    assertEquals(200, put("/" + index, mapping).statusCode(), "index " + index + " should create");
    return put("/" + index + "/_doc/1?refresh=true", doc);
  }

  private HttpResponse<String> put(String path, String body) throws Exception {
    return send("PUT", path, body);
  }

  private HttpResponse<String> send(String method, String path, String body) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(baseUrl + path))
            .header("Content-Type", "application/json")
            .method(
                method,
                body == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(body))
            .build();
    return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
