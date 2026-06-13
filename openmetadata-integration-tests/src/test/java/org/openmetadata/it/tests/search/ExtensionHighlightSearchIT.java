package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.OssTestServer;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * Reproduces the {@code extension.*} highlight 500: with a Highlight Field configured on a custom
 * property field ({@code extension.foundry_rid}) on {@code container_search_index}, container search
 * returned {@code all shards failed | Field [extension.foundry_rid] has no associated analyzer} —
 * {@code extension} is mapped {@code flattened}, which carries no analyzer, so the highlighter 500s.
 *
 * <p>Same class as {@link org.openmetadata.it.tests.FlattenedChildrenHighlightSearchIT} (highlight
 * on a no-analyzer field), but on the {@code extension} flattened field rather than the recursive
 * {@code object/enabled:false} children field — so it's a distinct guard: it asserts the highlighter
 * tolerates a configured-but-non-highlightable {@code extension.*} field instead of failing the
 * shard.
 *
 * <p>Mutates global SearchSettings → {@link Isolated}; OpenSearch-only (the 500 never manifested on
 * Elasticsearch); embedded-only (invalidates the in-JVM settings cache).
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class ExtensionHighlightSearchIT {

  private static final String EXTENSION_HIGHLIGHT_FIELD = "extension.foundry_rid";
  private static final String CONTAINER_ASSET_TYPE = "container";
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  @Test
  void highlightOnFlattenedExtensionFieldDoesNotFailTheShard(final TestNamespace ns)
      throws Exception {
    Assumptions.assumeTrue(
        !OssTestServer.isExternalMode(),
        "Mutates the in-JVM SearchSettings cache — embedded only, skipped in external mode");
    Assumptions.assumeTrue(
        "opensearch".equalsIgnoreCase(System.getProperty("searchType", "elasticsearch")),
        "The extension.* highlight 500 only ever manifested on OpenSearch");

    final String originalSettings = getSearchSettingsJson();
    final String token = ns.prefix("reproext").replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
    // Hyphenated term forces the query_string parse path, where the highlighter attempts every
    // configured highlight field — including the flattened extension.* field.
    final String searchTerm = "repro-ext-" + token;

    try {
      final StorageService service =
          ns.trackRoot(Entity.STORAGE_SERVICE, StorageServiceTestFactory.createS3(ns));
      final CreateContainer request = new CreateContainer();
      request.setName(ns.prefix("repro-ext-container"));
      request.setService(service.getFullyQualifiedName());
      request.setDescription(searchTerm);
      final Container container = SdkClients.adminClient().containers().create(request);

      awaitContainerSearchable(searchTerm);
      injectExtensionHighlightField();

      final HttpResponse<String> response = searchContainers(searchTerm);
      assertEquals(
          200,
          response.statusCode(),
          "highlighting the flattened extension.* field must not fail the shard (500). body="
              + response.body());
      assertTrue(
          response.body().contains(container.getId().toString()) || response.body().contains(token),
          "search should still return the indexed container");
    } finally {
      restoreSearchSettings(originalSettings);
    }
  }

  private void injectExtensionHighlightField() throws Exception {
    final Settings settings = JsonUtils.readValue(getSearchSettingsJson(), Settings.class);
    final SearchSettings config =
        JsonUtils.convertValue(settings.getConfigValue(), SearchSettings.class);
    for (final AssetTypeConfiguration assetConfig : config.getAssetTypeConfigurations()) {
      if (CONTAINER_ASSET_TYPE.equalsIgnoreCase(assetConfig.getAssetType())
          && !assetConfig.getHighlightFields().contains(EXTENSION_HIGHLIGHT_FIELD)) {
        assetConfig.getHighlightFields().add(EXTENSION_HIGHLIGHT_FIELD);
      }
    }
    settings.setConfigValue(config);
    putSearchSettings(JsonUtils.pojoToJson(settings));
    SettingsCache.invalidateSettings(SettingsType.SEARCH_SETTINGS.value());
  }

  private void awaitContainerSearchable(final String token) {
    Awaitility.await("container indexed in search")
        .atMost(180, TimeUnit.SECONDS)
        .pollInterval(1, TimeUnit.SECONDS)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              final HttpResponse<String> response = searchContainers(token);
              assertEquals(200, response.statusCode());
              assertTrue(response.body().contains(token));
            });
  }

  private HttpResponse<String> searchContainers(final String token) throws Exception {
    final String path =
        "/v1/search/query?q="
            + URLEncoder.encode(token, StandardCharsets.UTF_8)
            + "&index="
            + CONTAINER_ASSET_TYPE
            + "&from=0&size=10&deleted=false";
    return httpGet(path);
  }

  private String getSearchSettingsJson() throws Exception {
    return httpGet("/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value()).body();
  }

  private void putSearchSettings(final String body) throws Exception {
    final HttpRequest request =
        baseRequest("/v1/system/settings").PUT(HttpRequest.BodyPublishers.ofString(body)).build();
    final HttpResponse<String> response =
        HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertTrue(
        response.statusCode() >= 200 && response.statusCode() < 300,
        "Settings PUT should succeed, status=" + response.statusCode());
  }

  private void restoreSearchSettings(final String originalSettings) throws Exception {
    putSearchSettings(originalSettings);
    SettingsCache.invalidateSettings(SettingsType.SEARCH_SETTINGS.value());
  }

  private HttpResponse<String> httpGet(final String path) throws Exception {
    return HTTP_CLIENT.send(baseRequest(path).GET().build(), HttpResponse.BodyHandlers.ofString());
  }

  private HttpRequest.Builder baseRequest(final String path) {
    return HttpRequest.newBuilder()
        .uri(URI.create(SdkClients.getServerUrl() + path))
        .header("Authorization", "Bearer " + SdkClients.getAdminToken())
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .timeout(Duration.ofSeconds(30));
  }
}
