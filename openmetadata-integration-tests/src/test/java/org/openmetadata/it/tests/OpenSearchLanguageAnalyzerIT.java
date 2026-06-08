package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.apache.hc.core5.http.HttpHost;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.it.server.SearchTestImages;
import org.openmetadata.service.search.opensearch.OsUtils;
import org.opensearch.testcontainers.OpensearchContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.Requests;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5Transport;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;

/**
 * Verifies that the integration-test OpenSearch image ships the language-analysis plugins (see
 * {@link SearchTestImages}) and that the real, non-English index mappings — which reference those
 * plugins — create cleanly with their own analyzers (no analysis stripping).
 *
 * <p>This is the end-to-end guard the search suite lacked: jp text fields use {@code
 * kuromoji_tokenizer}, so a vanilla image could never create the jp indexes, and the jp mappings'
 * analyzer drift (fields referencing analyzers the file did not define) was invisible until now.
 * Creating the real jp mapping here fails if either the plugin is missing or an analyzer reference
 * is dangling.
 *
 * <p>en and ru use only built-in analyzers; jp uses {@code analysis-kuromoji}. zh ({@code
 * analysis-ik}) is excluded because that third-party plugin is not installed.
 */
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OpenSearchLanguageAnalyzerIT {

  private static final List<String> LANGUAGES_WITH_AVAILABLE_ANALYZERS = List.of("en", "ru", "jp");

  @Container
  static OpensearchContainer<?> opensearch =
      new OpensearchContainer<>(
              SearchTestImages.openSearchWithAnalysisPlugins("opensearchproject/opensearch:3.4.0"))
          .withStartupTimeout(Duration.ofMinutes(5))
          .withEnv("discovery.type", "single-node")
          .withEnv("DISABLE_SECURITY_PLUGIN", "true")
          .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
          .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");

  private OpenSearchClient openSearchClient;

  @BeforeAll
  void setUp() {
    HttpHost httpHost = new HttpHost("http", opensearch.getHost(), opensearch.getMappedPort(9200));
    ApacheHttpClient5Transport transport =
        ApacheHttpClient5TransportBuilder.builder(httpHost)
            .setMapper(new JacksonJsonpMapper())
            .build();
    openSearchClient = new OpenSearchClient(transport);
  }

  @AfterAll
  void tearDown() throws Exception {
    if (openSearchClient != null) {
      openSearchClient._transport().close();
    }
  }

  @Test
  void kuromojiAnalysisPluginIsInstalled() throws Exception {
    String plugins = execute("GET", "/_cat/plugins", null);
    assertTrue(
        plugins.contains("analysis-kuromoji"),
        "The integration-test OpenSearch image must ship analysis-kuromoji. Installed: " + plugins);
  }

  @Test
  void realLanguageMappingsCreateWithTheirOwnAnalyzers() throws Exception {
    List<String> failures = new ArrayList<>();
    for (String language : LANGUAGES_WITH_AVAILABLE_ANALYZERS) {
      String mapping =
          OsUtils.enrichIndexMappingForOpenSearch(
              readResource("/elasticsearch/" + language + "/topic_index_mapping.json"));
      String response = execute("PUT", "/lang_topic_" + language, mapping);
      if (!response.contains("\"acknowledged\":true")) {
        failures.add(language + " -> " + response);
      }
    }
    assertTrue(
        failures.isEmpty(),
        "Real index mapping (analyzers included) failed to create for language(s): " + failures);
  }

  private String readResource(String path) throws IOException {
    try (InputStream in = getClass().getResourceAsStream(path)) {
      assertNotNull(in, "Mapping resource not found on classpath: " + path);
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  private String execute(String method, String endpoint, String body) throws Exception {
    var builder = Requests.builder().method(method).endpoint(endpoint);
    if (body != null) {
      builder.json(body);
    }
    try (var response = openSearchClient.generic().execute(builder.build())) {
      return response.getBody().map(b -> b.bodyAsString()).orElse("");
    }
  }
}
