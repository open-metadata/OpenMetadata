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
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.migration.utils.v1130.MigrationUtil;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * Verifies that the stale {@code dataModel.columns.children.name} highlight field carried forward in
 * a cluster's DB-stored SearchSettings is now inert, and that the v1130 scrub migration ({@link
 * MigrationUtil#removeFlattenedChildrenSearchSettings()}) removes it.
 *
 * <p>When {@code dataModel.columns.children} was mapped {@code flattened}, highlighting this field
 * failed container search on OpenSearch with a 500 ("Field [dataModel.columns.children.name] has no
 * associated analyzer"). Mapping the recursive children as {@code object}/{@code "enabled": false}
 * leaves the field unmapped, so the highlighter skips it and the search succeeds (HTTP 200) even
 * before the scrub runs — the scrub then removes the dead entry from the stored settings.
 *
 * <p>OpenSearch only: the original 500 never manifested on Elasticsearch (it degraded the bad
 * highlight to a 200). The test mutates the global SearchSettings, so it is marked {@link Isolated}.
 */
@Slf4j
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class FlattenedChildrenHighlightSearchIT {

  private static final String STALE_HIGHLIGHT_FIELD = "dataModel.columns.children.name";
  private static final String CONTAINER_ASSET_TYPE = "container";
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  @Test
  void staleContainerChildrenHighlightIsInertAndScrubbed(TestNamespace ns) throws Exception {
    Assumptions.assumeTrue(
        "opensearch".equalsIgnoreCase(System.getProperty("searchType", "elasticsearch")),
        "The flattened-children highlight 500 only ever manifested on OpenSearch");

    OpenMetadataClient client = SdkClients.adminClient();
    String originalSettings = getSearchSettingsJson();
    String token = ns.prefix("reprohl").replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
    // Hyphenated term forces the query_string parse path (like the incident's pw\-container\-...),
    // where per-field match attribution breaks down and the highlighter attempts every configured
    // highlight field - including the (now unmapped) flattened children field.
    String searchTerm = "repro-hl-" + token;

    try {
      StorageService service = StorageServiceTestFactory.createS3(ns);
      Column childColumn =
          new Column().withName("child_" + token).withDataType(ColumnDataType.STRING);
      Column structColumn =
          new Column()
              .withName("col1")
              .withDataType(ColumnDataType.STRUCT)
              .withChildren(List.of(childColumn));
      ContainerDataModel dataModel = new ContainerDataModel().withColumns(List.of(structColumn));
      CreateContainer request = new CreateContainer();
      request.setName(ns.prefix("repro-container"));
      request.setService(service.getFullyQualifiedName());
      request.setDescription(searchTerm);
      request.setDataModel(dataModel);
      Container container = client.containers().create(request);
      log.info("Created container {} for highlight repro", container.getId());

      awaitContainerSearchable(searchTerm);

      injectStaleContainerHighlightField();

      // object/enabled:false leaves dataModel.columns.children.name unmapped, so the highlighter
      // skips it and the search succeeds - whereas the flattened mapping returned a 500 here.
      HttpResponse<String> withStaleField = searchContainers(searchTerm);
      log.info(
          "Container search with stale highlight field -> status={}", withStaleField.statusCode());
      assertEquals(
          200,
          withStaleField.statusCode(),
          "object/enabled:false leaves the children highlight field unmapped, so the search must not 500");
      assertTrue(
          withStaleField.body().contains(token), "Search should return the indexed container");

      MigrationUtil.removeFlattenedChildrenSearchSettings();
      SettingsCache.invalidateSettings(SettingsType.SEARCH_SETTINGS.value());

      assertFalse(
          containerHighlightFields().contains(STALE_HIGHLIGHT_FIELD),
          "Scrub must remove the stale children highlight field from the stored settings");

      HttpResponse<String> afterScrub = searchContainers(searchTerm);
      assertEquals(200, afterScrub.statusCode(), "Search must still succeed after the scrub");
      assertTrue(
          afterScrub.body().contains(token), "Scrubbed search should still return the container");
    } finally {
      restoreSearchSettings(originalSettings);
    }
  }

  private void injectStaleContainerHighlightField() throws Exception {
    Settings settings = JsonUtils.readValue(getSearchSettingsJson(), Settings.class);
    SearchSettings config = JsonUtils.convertValue(settings.getConfigValue(), SearchSettings.class);
    for (AssetTypeConfiguration assetConfig : config.getAssetTypeConfigurations()) {
      if (CONTAINER_ASSET_TYPE.equalsIgnoreCase(assetConfig.getAssetType())
          && !assetConfig.getHighlightFields().contains(STALE_HIGHLIGHT_FIELD)) {
        assetConfig.getHighlightFields().add(STALE_HIGHLIGHT_FIELD);
      }
    }
    settings.setConfigValue(config);
    putSearchSettings(JsonUtils.pojoToJson(settings));
  }

  private List<String> containerHighlightFields() throws Exception {
    Settings settings = JsonUtils.readValue(getSearchSettingsJson(), Settings.class);
    SearchSettings config = JsonUtils.convertValue(settings.getConfigValue(), SearchSettings.class);
    return config.getAssetTypeConfigurations().stream()
        .filter(c -> CONTAINER_ASSET_TYPE.equalsIgnoreCase(c.getAssetType()))
        .findFirst()
        .map(AssetTypeConfiguration::getHighlightFields)
        .orElse(List.of());
  }

  private void awaitContainerSearchable(String token) {
    Awaitility.await("container indexed in search")
        .atMost(180, TimeUnit.SECONDS)
        .pollInterval(1, TimeUnit.SECONDS)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              HttpResponse<String> response = searchContainers(token);
              assertEquals(200, response.statusCode());
              assertTrue(response.body().contains(token));
            });
  }

  private HttpResponse<String> searchContainers(String token) throws Exception {
    String path =
        "/v1/search/query?q="
            + URLEncoder.encode(token, StandardCharsets.UTF_8)
            + "&index="
            + CONTAINER_ASSET_TYPE
            + "&from=0&size=10&deleted=false";
    return httpGet(path, "application/json");
  }

  private String getSearchSettingsJson() throws Exception {
    return httpGet(
            "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(), "application/json")
        .body();
  }

  private void putSearchSettings(String body) throws Exception {
    HttpRequest request =
        baseRequest("/v1/system/settings", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(body))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertTrue(
        response.statusCode() >= 200 && response.statusCode() < 300,
        "Settings PUT should succeed, status=" + response.statusCode());
  }

  private void restoreSearchSettings(String originalSettings) throws Exception {
    putSearchSettings(originalSettings);
    SettingsCache.invalidateSettings(SettingsType.SEARCH_SETTINGS.value());
  }

  private HttpResponse<String> httpGet(String path, String accept) throws Exception {
    HttpRequest request = baseRequest(path, accept).GET().build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpRequest.Builder baseRequest(String path, String accept) {
    return HttpRequest.newBuilder()
        .uri(URI.create(SdkClients.getServerUrl() + path))
        .header("Authorization", "Bearer " + SdkClients.getAdminToken())
        .header("Content-Type", "application/json")
        .header("Accept", accept)
        .timeout(Duration.ofSeconds(30));
  }
}
