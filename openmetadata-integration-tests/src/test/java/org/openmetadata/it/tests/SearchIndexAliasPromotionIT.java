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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * End-to-end regression guard for the per-entity alias promotion path.
 *
 * <p>The {@code SearchIndexingApplication} stages each entity's reindex into a fresh index with
 * {@code BulkIndexOverrides} applied (typically {@code refresh_interval=-1},
 * {@code number_of_replicas=0}, {@code translog.durability=async}) so the bulk write has minimum
 * indexing-side amplification. Before swapping the alias, those overrides MUST be reverted to live
 * serving values, or live writes after promotion are buffered indefinitely and only become
 * searchable on a manual {@code _refresh} — surfacing as the "freshly created entity does not
 * appear in search until reindex" production symptom.
 *
 * <p>This test triggers the bundled app with bulk overrides set, waits for completion, then
 * queries {@code _settings} on a representative entity index that the app reindexed and asserts
 * the live values are present, NOT the bulk overrides. Catches both halves of the original
 * regression: missing {@code applyLiveServingSettings} call in {@code promoteEntityIndex}, and
 * missing {@code withJobData} wiring on the per-entity handler.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class SearchIndexAliasPromotionIT {

  private static final String APP_NAME = "SearchIndexingApplication";
  private static final String CLUSTER_ALIAS = "openmetadata";
  private static final String SETTINGS_INDEX = CLUSTER_ALIAS + "_table_search_index";
  private static final ObjectMapper MAPPER = new ObjectMapper();

  @BeforeAll
  static void setup() {
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void perEntityPromotionRestoresLiveSettingsOnStagedIndex() throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");

    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    waitForCurrentRunCompletion(httpClient);
    Long previousRunStartTime = readLatestRunStartTime(httpClient);
    triggerWithBulkOverrides(httpClient);
    waitForLatestRunSuccess(httpClient, previousRunStartTime);

    Map<String, JsonNode> settingsByIndex = readIndexSettings(SETTINGS_INDEX);
    assertTrue(
        !settingsByIndex.isEmpty(),
        () ->
            "No concrete index resolved for alias '"
                + SETTINGS_INDEX
                + "'. Expected the reindex to produce a staged index that now serves the alias.");

    boolean anyRebuildIndex =
        settingsByIndex.keySet().stream().anyMatch(name -> name.contains("_rebuild_"));
    assertTrue(
        anyRebuildIndex,
        () ->
            "Alias '"
                + SETTINGS_INDEX
                + "' resolves only to "
                + settingsByIndex.keySet()
                + ", none of which is a *_rebuild_* index. The promotion did not move the alias"
                + " to a freshly staged index — assertions below would pass against the"
                + " pre-existing live index and miss the regression.");

    for (Map.Entry<String, JsonNode> entry : settingsByIndex.entrySet()) {
      String concreteIndex = entry.getKey();
      JsonNode indexSettings = entry.getValue();
      String refresh = textOrNull(indexSettings.path("refresh_interval"));
      String replicas = textOrNull(indexSettings.path("number_of_replicas"));
      String durability = textOrNull(indexSettings.path("translog").path("durability"));

      assertNotEquals(
          "-1",
          refresh,
          () ->
              "Index '"
                  + concreteIndex
                  + "' kept bulk-build refresh_interval=-1 after promotion — "
                  + "applyLiveServingSettings was not invoked on the per-entity promote path.");
      assertNotEquals(
          "0",
          replicas,
          () ->
              "Index '"
                  + concreteIndex
                  + "' kept bulk-build number_of_replicas=0 after promotion.");
      if (durability != null) {
        assertNotEquals(
            "async",
            durability,
            () ->
                "Index '"
                    + concreteIndex
                    + "' kept bulk-build translog.durability=async after promotion.");
      }

      assertEquals(
          "1s",
          refresh,
          () -> "Expected live refresh_interval=1s on '" + concreteIndex + "', got " + refresh);
      assertEquals(
          "1",
          replicas,
          () -> "Expected live number_of_replicas=1 on '" + concreteIndex + "', got " + replicas);
    }
  }

  private static void triggerWithBulkOverrides(HttpClient httpClient) {
    Map<String, Object> bulk = new HashMap<>();
    bulk.put("numberOfReplicas", 0);
    bulk.put("refreshInterval", "-1");
    bulk.put("translogDurability", "async");
    bulk.put("translogSyncInterval", "30s");

    Map<String, Object> config = new HashMap<>();
    config.put("entities", List.of("table"));
    config.put("recreateIndex", true);
    config.put("batchSize", 100);
    config.put("bulkIndexSettings", bulk);

    Awaitility.await("Trigger " + APP_NAME)
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptionsMatching(
            e -> e.getMessage() != null && e.getMessage().contains("already running"))
        .until(
            () -> {
              httpClient.execute(
                  HttpMethod.POST, "/v1/apps/trigger/" + APP_NAME, config, Void.class);
              return true;
            });
  }

  private static AppRunRecord waitForLatestRunSuccess(
      HttpClient httpClient, Long previousRunStartTime) {
    AppRunRecord[] holder = new AppRunRecord[1];
    Awaitility.await("Reindex run completion")
        .atMost(Duration.ofMinutes(10))
        .pollDelay(Duration.ofSeconds(2))
        .pollInterval(Duration.ofSeconds(5))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              AppRunRecord run =
                  httpClient.execute(
                      HttpMethod.GET,
                      "/v1/apps/name/" + APP_NAME + "/runs/latest",
                      null,
                      AppRunRecord.class);
              assertNotNull(run);
              assertNotNull(run.getStatus());
              if (previousRunStartTime != null
                  && run.getStartTime() != null
                  && run.getStartTime() <= previousRunStartTime) {
                throw new AssertionError("Latest run is still the pre-trigger one");
              }
              String status = run.getStatus().value();
              assertTrue(
                  "success".equalsIgnoreCase(status)
                      || "completed".equalsIgnoreCase(status)
                      || "failed".equalsIgnoreCase(status)
                      || "activeError".equalsIgnoreCase(status),
                  "Run not in terminal state yet: " + status);
              holder[0] = run;
            });
    AppRunRecord run = holder[0];
    String status = run.getStatus().value().toLowerCase();
    assertTrue(
        "success".equals(status) || "completed".equals(status),
        () ->
            "Reindex run finished in non-success state '"
                + status
                + "'. activeError / completedWithErrors paths can leave the alias on the old"
                + " live index, which already has live settings — the post-run assertions"
                + " would pass without proving anything. Run="
                + run);
    return run;
  }

  private static Long readLatestRunStartTime(HttpClient httpClient) {
    try {
      AppRunRecord latest =
          httpClient.execute(
              HttpMethod.GET,
              "/v1/apps/name/" + APP_NAME + "/runs/latest",
              null,
              AppRunRecord.class);
      return latest == null ? null : latest.getStartTime();
    } catch (Exception ignored) {
      return null;
    }
  }

  private static void waitForCurrentRunCompletion(HttpClient httpClient) {
    try {
      Awaitility.await("Wait for in-flight " + APP_NAME)
          .atMost(Duration.ofMinutes(5))
          .pollInterval(Duration.ofSeconds(3))
          .ignoreExceptions()
          .until(
              () -> {
                AppRunRecord latest =
                    httpClient.execute(
                        HttpMethod.GET,
                        "/v1/apps/name/" + APP_NAME + "/runs/latest",
                        null,
                        AppRunRecord.class);
                if (latest == null || latest.getStatus() == null) {
                  return true;
                }
                String status = latest.getStatus().value().toLowerCase();
                return !"running".equals(status) && !"started".equals(status);
              });
    } catch (org.awaitility.core.ConditionTimeoutException ignored) {
      // Best-effort wait; the trigger logic retries on "already running".
    }
  }

  /**
   * GET {@code <indexOrAlias>/_settings} and return a map of resolved concrete index → its
   * {@code settings.index} subtree. When the argument is an alias, the response is keyed by the
   * underlying concrete index, which may include the rebuild-suffixed staged-then-promoted index.
   */
  private static Map<String, JsonNode> readIndexSettings(String indexOrAlias) throws Exception {
    try (Rest5Client searchClient = TestSuiteBootstrap.createSearchClient()) {
      Request request = new Request("GET", "/" + indexOrAlias + "/_settings");
      Response response = searchClient.performRequest(request);
      assertEquals(200, response.getStatusCode());
      String body =
          new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
      JsonNode root = MAPPER.readTree(body);
      Map<String, JsonNode> result = new HashMap<>();
      Iterator<Map.Entry<String, JsonNode>> it = root.fields();
      while (it.hasNext()) {
        Map.Entry<String, JsonNode> entry = it.next();
        JsonNode indexSettings = entry.getValue().path("settings").path("index");
        if (indexSettings.isMissingNode() || indexSettings.isNull()) {
          continue;
        }
        result.put(entry.getKey(), indexSettings);
      }
      return result;
    }
  }

  private static String textOrNull(JsonNode node) {
    return node == null || node.isMissingNode() || node.isNull() ? null : node.asText();
  }
}
