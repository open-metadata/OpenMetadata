package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpServer;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.ForkedOperations;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration.SearchType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

@Isolated
@ExtendWith(TestNamespaceExtension.class)
class ReembedOperationsIT {
  private static final List<Double> EMBEDDING = List.of(0.5, 0.25, 0.125);

  @Test
  void reembedWritesVectorsToElasticsearchUsingTheConfiguredProvider(TestNamespace namespace)
      throws IOException {
    assumeFalse(OssTestServer.isExternalMode(), "Requires a dedicated test search cluster");
    final SearchRepository repository = Entity.getSearchRepository();
    assumeTrue(
        repository.getSearchType() == SearchType.ELASTICSEARCH,
        "Exercises the Elasticsearch vector write path");

    final Glossary glossary = GlossaryTestFactory.createSimple(namespace);
    final String clusterAlias = namespace.shortPrefix("reembed");
    final String index = repository.getIndexMapping(Entity.GLOSSARY).getIndexName(clusterAlias);
    final HttpServer provider = startEmbeddingProvider();
    try (Rest5Client searchClient = TestSuiteBootstrap.createSearchClient()) {
      createSearchIndex(searchClient, index);
      try {
        seedSearchDocument(searchClient, index, glossary);
        assertReembedded(
            searchClient, index, glossary, clusterAlias, provider.getAddress().getPort());
      } finally {
        deleteSearchIndexes(searchClient, clusterAlias);
      }
    } finally {
      provider.stop(0);
    }
  }

  private static void assertReembedded(
      Rest5Client client, String index, Glossary glossary, String clusterAlias, int providerPort)
      throws IOException {
    final int exitCode =
        ForkedOperations.run(
            config -> configureEmbeddings(config, clusterAlias, providerPort),
            "reembed",
            "--producer-threads",
            "1",
            "--consumer-threads",
            "1");
    assertEquals(0, exitCode, "See target/forked-ops-*.log");
    final Request request = new Request("GET", "/" + index + "/_source/" + glossary.getId());
    try (var response = client.performRequest(request).getEntity().getContent()) {
      assertEquals(
          JsonUtils.valueToTree(EMBEDDING),
          JsonUtils.readTree(new String(response.readAllBytes(), StandardCharsets.UTF_8))
              .path("embedding"));
    }
  }

  private static void configureEmbeddings(ObjectNode config, String clusterAlias, int port) {
    final ObjectNode search = (ObjectNode) config.get("elasticsearch");
    search.put("clusterAlias", clusterAlias);
    search.putObject("naturalLanguageSearch").put("semanticSearchEnabled", true);

    final ObjectNode llm = config.putObject("llmConfiguration");
    llm.put("enabled", true).put("provider", "noop");
    llm.putObject("openai").put("apiKey", "test-key").put("endpoint", "http://127.0.0.1:" + port);
    llm.putObject("embeddings")
        .put("provider", "openai")
        .putObject("openai")
        .put("embeddingModelId", "test-embedding")
        .put("embeddingDimension", EMBEDDING.size());
  }

  private static HttpServer startEmbeddingProvider() throws IOException {
    final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    final byte[] response =
        ("{\"data\":[{\"embedding\":" + JsonUtils.pojoToJson(EMBEDDING) + "}]}")
            .getBytes(StandardCharsets.UTF_8);
    server.createContext(
        "/embeddings",
        exchange -> {
          try (exchange) {
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
          }
        });
    server.start();
    return server;
  }

  private static void createSearchIndex(Rest5Client client, String index) throws IOException {
    final Request create = new Request("PUT", "/" + index);
    create.setJsonEntity(
        """
        {"settings":{"index.mapping.exclude_source_vectors":false},
         "mappings":{"properties":{"embedding":{"type":"dense_vector","dims":%d}}}}
        """
            .formatted(EMBEDDING.size()));
    client.performRequest(create);
  }

  private static void deleteSearchIndexes(Rest5Client client, String clusterAlias)
      throws IOException {
    final Request list = new Request("GET", "/_cat/indices/" + clusterAlias + "_*");
    list.addParameter("format", "json");
    list.addParameter("h", "index");
    try (var response = client.performRequest(list).getEntity().getContent()) {
      for (JsonNode index :
          JsonUtils.readTree(new String(response.readAllBytes(), StandardCharsets.UTF_8))) {
        client.performRequest(new Request("DELETE", "/" + index.path("index").asText()));
      }
    }
  }

  private static void seedSearchDocument(Rest5Client client, String index, Glossary glossary)
      throws IOException {
    final Request seed = new Request("PUT", "/" + index + "/_doc/" + glossary.getId());
    seed.setJsonEntity("{}");
    client.performRequest(seed);
  }
}
