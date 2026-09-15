/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
 *  implied. See the License for the specific language governing permissions and limitations under the License.
 */
package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * End-to-end repro of the reindex double-count defect against a live testcontainers cluster.
 *
 * <p>Simulates the reindex window the way {@code DefaultRecreateHandler} creates it: a staged
 * {@code <canon>_rebuild_<digits>} physical index coexisting with the live (aliased) index, with
 * real {@code pri.store.size}, but no OM alias (the alias is only attached at promotion). Then hits
 * the real {@code /v1/system/search/fitness} endpoint and asserts the analyzer de-duplicates the
 * sibling before summing — {@code totalPrimarySizeBytes} must NOT change when the staged sibling is
 * added, and the staged sibling must NOT appear in {@code indices}.
 *
 * <p>Embedded-only: it writes raw docs to the cluster to give the staged index real
 * {@code pri.store.size}, which external mode does not expose.
 */
@Execution(ExecutionMode.SAME_THREAD)
class SearchClusterFitnessReindexE2EIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Duration TIMEOUT = Duration.ofSeconds(30);
  private static final String FITNESS_PATH = "/v1/system/search/fitness";
  private static final int STAGED_DOCS = 50;
  // Each staged doc carries a ~10 KB text field so the staged index has a non-trivial
  // pri.store.size (well above measurement noise) — making a double-count unambiguous.
  private static final String STAGED_FIELD_VALUE = "x".repeat(10 * 1024);

  private static ServerHandle server;
  private static HttpClient http;
  private static URI clusterBase;
  private static String clusterAlias;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    assumeTrue(
        !server.isExternal(),
        "Writing raw docs to the cluster needs direct access; external mode does not expose it");
    http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    clusterBase =
        URI.create(server.searchScheme() + "://" + server.searchHost() + ":" + server.searchPort());
    clusterAlias = org.openmetadata.service.Entity.getSearchRepository().getClusterAlias();
  }

  @Test
  void stagedRebuildSiblingIsNotDoubleCounted() throws Exception {
    // 1. Locate the live physical index for the table canonical index (the one carrying the
    //    `openmetadata_table` OM alias), and derive its canonical key. Both the first-install
    //    shape (plain `openmetadata_table_search_index`) and the steady-state shape
    //    (`openmetadata_table_search_index_rebuild_<olderTs>`) are handled.
    String prefix = (clusterAlias == null || clusterAlias.isEmpty()) ? "" : clusterAlias + "_";
    String canonical = prefix + "table_search_index";
    String tableAlias = prefix + "table";
    String liveIndex = findLiveAliasedIndex(canonical, tableAlias);
    assertThat(liveIndex)
        .as("a live index carrying the %s alias must exist after bootstrap", tableAlias)
        .isNotNull();

    // 2. Snapshot the fitness report BEFORE introducing the staged sibling.
    JsonNode before = fetchFitnessReport();
    long totalPrimaryBefore = before.get("totalPrimarySizeBytes").asLong();
    Set<String> indicesBefore = indexNames(before);

    // 3. Create the staged rebuild sibling (NO alias — exactly as DefaultRecreateHandler does) and
    //    give it real primary bytes by bulk-indexing docs, then refresh so pri.store.size realizes.
    long ts = System.currentTimeMillis();
    String stagedIndex = canonical + "_rebuild_" + ts;
    try {
      createIndex(stagedIndex);
      bulkIndex(stagedIndex, STAGED_DOCS);
      refresh(stagedIndex);

      // Sanity: the staged sibling now exists with non-zero pri.store.size, and it does NOT carry
      // the OM alias. This confirms we reproduced the bug's precondition.
      long stagedPrimary = primarySize(stagedIndex);
      assertThat(stagedPrimary)
          .as("staged sibling must have non-zero pri.store.size for the double-count to manifest")
          .isGreaterThan(0L);
      assertThat(indexCarriesAlias(stagedIndex, tableAlias))
          .as("staged sibling must NOT carry the OM alias (matches DefaultRecreateHandler)")
          .isFalse();
      assertThat(indexCarriesAlias(liveIndex, tableAlias))
          .as("live index must carry the OM alias")
          .isTrue();

      // 4. Snapshot the fitness report AFTER introducing the staged sibling.
      JsonNode after = fetchFitnessReport();
      long totalPrimaryAfter = after.get("totalPrimarySizeBytes").asLong();
      Set<String> indicesAfter = indexNames(after);

      // 5. The fix: the staged sibling is de-duplicated against the live index, so:
      //    - totalPrimarySizeBytes is unchanged (the staged sibling's bytes are NOT added).
      //    - the staged sibling does NOT appear in the reported indices list.
      assertThat(totalPrimaryAfter)
          .as(
              "totalPrimarySizeBytes must not change when a staged rebuild sibling is added "
                  + "(before=%d, after=%d, stagedPrimary=%d); the bug would add the staged bytes",
              totalPrimaryBefore, totalPrimaryAfter, stagedPrimary)
          .isEqualTo(totalPrimaryBefore);

      assertThat(indicesAfter)
          .as("the staged rebuild sibling must not appear in the reported indices list")
          .doesNotContain(stagedIndex);
      assertThat(indicesAfter)
          .as("the live index must still appear in the reported indices list")
          .contains(liveIndex);
      assertThat(indicesAfter)
          .as("no new index should appear after adding a de-duplicated sibling")
          .isEqualTo(indicesBefore);
    } finally {
      deleteIndexQuietly(stagedIndex);
    }
  }

  @Test
  void stagedRebuildSiblingDedupedWhenAliasesInaccessible() throws Exception {
    // Procedure H: when /_cat/aliases is effectively empty (the live index carries no OM alias),
    // the analyzer's indicesWithOmAlias is empty and collapseRebuildSiblings falls back to
    // keeping the larger primarySizeBytes. We simulate this by temporarily removing the OM alias
    // from the live index, then exercising the same staged-sibling scenario as the aliased test.
    // The de-dup must still happen (one footprint, total not summed), just via the keep-larger
    // rule — which keeps the live index here because the live index is larger than the tiny
    // staged sibling.
    String prefix = (clusterAlias == null || clusterAlias.isEmpty()) ? "" : clusterAlias + "_";
    String canonical = prefix + "table_search_index";
    String tableAlias = prefix + "table";
    String liveIndex = findLiveAliasedIndex(canonical, tableAlias);
    assertThat(liveIndex)
        .as("a live index carrying the %s alias must exist after bootstrap", tableAlias)
        .isNotNull();

    // Snapshot before any mutation.
    JsonNode before = fetchFitnessReport();
    long totalPrimaryBefore = before.get("totalPrimarySizeBytes").asLong();
    Set<String> indicesBefore = indexNames(before);
    boolean liveHadAlias = indexCarriesAlias(liveIndex, tableAlias);

    long ts = System.currentTimeMillis();
    String stagedIndex = canonical + "_rebuild_" + ts;
    boolean aliasRemoved = false;
    try {
      // Remove the OM alias from the live index so /_cat/aliases no longer marks it as an
      // OpenMetadata-alias target. isOpenMetadataIndex still matches both the live (canonical/
      // substring) and the staged (substring) indices, but indicesWithOmAlias is now empty for
      // this canonical, forcing the keep-larger fallback in collapseRebuildSiblings.
      if (liveHadAlias) {
        removeAlias(liveIndex, tableAlias);
        aliasRemoved = true;
      }
      // Also remove the canonical-name alias if present (the getAliasesFromMapping attaches both
      // the short alias and the canonical index name as aliases).
      if (indexCarriesAlias(liveIndex, canonical)) {
        removeAlias(liveIndex, canonical);
      }

      createIndex(stagedIndex);
      bulkIndex(stagedIndex, STAGED_DOCS);
      refresh(stagedIndex);
      long stagedPrimary = primarySize(stagedIndex);
      assertThat(stagedPrimary)
          .as("staged sibling must have non-zero pri.store.size")
          .isGreaterThan(0L);

      JsonNode after = fetchFitnessReport();
      long totalPrimaryAfter = after.get("totalPrimarySizeBytes").asLong();
      Set<String> indicesAfter = indexNames(after);

      // The keep-larger fallback keeps the live index (live at ~MB-scale > staged at ~KB-scale),
      // so the total is unchanged. With the bug (no collapse at all), the staged bytes would be
      // ADDED to the total — totalPrimaryAfter would be totalPrimaryBefore + stagedPrimary.
      assertThat(totalPrimaryAfter)
          .as(
              "totalPrimarySizeBytes must not change under the keep-larger fallback either "
                  + "(before=%d, after=%d, stagedPrimary=%d); the bug would add the staged bytes",
              totalPrimaryBefore, totalPrimaryAfter, stagedPrimary)
          .isEqualTo(totalPrimaryBefore);
      assertThat(indicesAfter)
          .as("the staged rebuild sibling must not appear in the reported indices list")
          .doesNotContain(stagedIndex);
      // Exactly one footprint for this canonical remains.
      long canonicalFootprintCount =
          indicesAfter.stream().filter(n -> n.equals(liveIndex) || n.equals(stagedIndex)).count();
      assertThat(canonicalFootprintCount)
          .as("exactly one footprint for the table canonical must remain after de-dup")
          .isEqualTo(1L);
    } finally {
      // Best-effort restore: re-add the alias we removed so the cluster is left as we found it.
      if (aliasRemoved) {
        try {
          addAlias(liveIndex, tableAlias);
        } catch (Exception ignored) {
          // best-effort
        }
      }
      deleteIndexQuietly(stagedIndex);
    }
    // Verify we actually restored the alias.
    if (liveHadAlias) {
      assertThat(indexCarriesAlias(liveIndex, tableAlias))
          .as("live index alias must be restored after the test")
          .isTrue();
    }
  }

  // ----------------------------------------------------------------------------------------------
  // Fitness endpoint
  // ----------------------------------------------------------------------------------------------

  private JsonNode fetchFitnessReport() throws Exception {
    OpenMetadataClient client = server.sdk();
    String body =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, FITNESS_PATH, null, RequestOptions.builder().build());
    assertThat(body).as("fitness endpoint should return a non-empty body").isNotBlank();
    return MAPPER.readTree(body);
  }

  private Set<String> indexNames(JsonNode report) {
    Set<String> names = new HashSet<>();
    JsonNode indices = report.get("indices");
    if (indices != null && indices.isArray()) {
      for (JsonNode idx : indices) {
        names.add(idx.get("indexName").asText());
      }
    }
    return names;
  }

  // ----------------------------------------------------------------------------------------------
  // Cluster introspection (raw _cat REST)
  // ----------------------------------------------------------------------------------------------

  private String findLiveAliasedIndex(String canonical, String alias) throws Exception {
    // Find indices whose name maps to this canonical key, then return the one carrying the alias.
    JsonNode catIndices = readJson(clusterBase.resolve("/_cat/indices?format=json&bytes=b"));
    Set<String> candidates = new HashSet<>();
    for (JsonNode row : catIndices) {
      String name = row.get("index").asText();
      if (canonical.equals(name) || name.startsWith(canonical + "_rebuild_")) {
        candidates.add(name);
      }
    }
    if (candidates.isEmpty()) {
      return null;
    }
    JsonNode catAliases = readJson(clusterBase.resolve("/_cat/aliases?format=json"));
    for (JsonNode row : catAliases) {
      if (alias.equals(row.get("alias").asText())) {
        String backing = row.get("index").asText();
        if (candidates.contains(backing)) {
          return backing;
        }
      }
    }
    // Fallback: if no alias row points at a candidate, prefer the plain canonical if present.
    return candidates.contains(canonical) ? canonical : candidates.iterator().next();
  }

  private long primarySize(String index) throws Exception {
    JsonNode catIndices = readJson(clusterBase.resolve("/_cat/indices?format=json&bytes=b"));
    for (JsonNode row : catIndices) {
      if (index.equals(row.get("index").asText())) {
        return Long.parseLong(row.get("pri.store.size").asText());
      }
    }
    throw new IllegalStateException("index " + index + " not found in _cat/indices");
  }

  private boolean indexCarriesAlias(String index, String alias) throws Exception {
    JsonNode catAliases = readJson(clusterBase.resolve("/_cat/aliases?format=json"));
    for (JsonNode row : catAliases) {
      if (index.equals(row.get("index").asText()) && alias.equals(row.get("alias").asText())) {
        return true;
      }
    }
    return false;
  }

  // ----------------------------------------------------------------------------------------------
  // Cluster mutation (raw REST)
  // ----------------------------------------------------------------------------------------------

  private void createIndex(String index) throws Exception {
    int status =
        send(
            "PUT",
            "/" + index,
            "{\"settings\":{\"index\":{\"number_of_shards\":1,\"number_of_replicas\":0}}}");
    if (status >= 300) {
      throw new IllegalStateException("create index " + index + " failed: HTTP " + status);
    }
  }

  private void bulkIndex(String index, int count) throws Exception {
    StringBuilder body = new StringBuilder();
    for (int i = 0; i < count; i++) {
      body.append("{\"index\":{\"_index\":\"")
          .append(index)
          .append("\",\"_id\":\"")
          .append(i)
          .append("\"}}\n")
          .append("{\"name\":\"doc-")
          .append(i)
          .append("\",\"payload\":\"")
          .append(STAGED_FIELD_VALUE)
          .append("\"}\n");
    }
    int status = send("POST", "/_bulk?refresh=true", body.toString());
    if (status >= 300) {
      throw new IllegalStateException("bulk index into " + index + " failed: HTTP " + status);
    }
  }

  private void refresh(String index) throws Exception {
    int status = send("POST", "/" + index + "/_refresh", null);
    if (status >= 300) {
      throw new IllegalStateException("refresh " + index + " failed: HTTP " + status);
    }
  }

  private void removeAlias(String index, String alias) throws Exception {
    int status = send("DELETE", "/" + index + "/_alias/" + alias, null);
    if (status >= 300 && status != 404) {
      throw new IllegalStateException(
          "remove alias " + alias + " from " + index + " failed: HTTP " + status);
    }
  }

  private void addAlias(String index, String alias) throws Exception {
    int status = send("PUT", "/" + index + "/_alias/" + alias, null);
    if (status >= 300) {
      throw new IllegalStateException(
          "add alias " + alias + " to " + index + " failed: HTTP " + status);
    }
  }

  private void deleteIndexQuietly(String index) {
    try {
      send("DELETE", "/" + index, null);
    } catch (Exception ignored) {
      // best-effort cleanup
    }
  }

  // ----------------------------------------------------------------------------------------------
  // HTTP plumbing
  // ----------------------------------------------------------------------------------------------

  private JsonNode readJson(URI uri) throws Exception {
    HttpRequest request = HttpRequest.newBuilder().uri(uri).timeout(TIMEOUT).GET().build();
    HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      throw new IllegalStateException("GET " + uri + " failed: HTTP " + response.statusCode());
    }
    return MAPPER.readTree(response.body());
  }

  private int send(String method, String path, String body) throws Exception {
    HttpRequest.BodyPublisher publisher =
        body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(clusterBase.resolve(path))
            .timeout(TIMEOUT)
            .header("Content-Type", "application/json")
            .method(method, publisher)
            .build();
    return http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
  }
}
