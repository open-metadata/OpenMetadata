package org.openmetadata.service.search.vector.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.Openai;

class OpenAIEmbeddingClientTest {

  @Test
  void testClientCreationWithConfig() {
    ElasticSearchConfiguration config = buildConfig("test-key", "text-embedding-3-small", 1536);
    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);

    assertEquals(1536, client.getDimension());
    assertEquals("text-embedding-3-small", client.getModelId());
  }

  @Test
  void testClientCreationWithCustomModel() {
    ElasticSearchConfiguration config = buildConfig("test-key", "text-embedding-ada-002", 768);
    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);

    assertEquals(768, client.getDimension());
    assertEquals("text-embedding-ada-002", client.getModelId());
  }

  @Test
  void testAzureEndpointResolution() {
    Openai openaiCfg =
        new Openai()
            .withApiKey("test-key")
            .withEmbeddingModelId("text-embedding-3-small")
            .withEmbeddingDimension(1536)
            .withEndpoint("https://my-resource.openai.azure.com")
            .withDeploymentName("my-deployment")
            .withApiVersion("2024-02-01");

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);
    assertNotNull(client);
  }

  @Test
  void testAzureWithoutApiVersionThrows() {
    Openai openaiCfg =
        new Openai()
            .withApiKey("test-key")
            .withEmbeddingModelId("text-embedding-3-small")
            .withEmbeddingDimension(1536)
            .withEndpoint("https://my-resource.openai.azure.com")
            .withDeploymentName("my-deployment")
            .withApiVersion(null);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new OpenAIEmbeddingClient(config));
  }

  @Test
  void testMissingApiKeyThrows() {
    Openai openaiCfg =
        new Openai().withEmbeddingModelId("text-embedding-3-small").withEmbeddingDimension(1536);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new OpenAIEmbeddingClient(config));
  }

  @Test
  void testMissingModelIdThrows() {
    Openai openaiCfg =
        new Openai().withApiKey("test-key").withEmbeddingModelId(null).withEmbeddingDimension(1536);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new OpenAIEmbeddingClient(config));
  }

  @Test
  void testInvalidDimensionThrows() {
    Openai openaiCfg =
        new Openai()
            .withApiKey("test-key")
            .withEmbeddingModelId("text-embedding-3-small")
            .withEmbeddingDimension(0);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new OpenAIEmbeddingClient(config));
  }

  @Test
  void testNullTextThrows() {
    ElasticSearchConfiguration config = buildConfig("test-key", "text-embedding-3-small", 1536);
    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);

    assertThrows(IllegalArgumentException.class, () -> client.embed(null));
  }

  @Test
  void testBlankTextThrows() {
    ElasticSearchConfiguration config = buildConfig("test-key", "text-embedding-3-small", 1536);
    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);

    assertThrows(IllegalArgumentException.class, () -> client.embed("   "));
  }

  @Test
  void testEmbeddingWithUnreachableEndpoint() {
    Openai openaiCfg =
        new Openai()
            .withApiKey("test-key")
            .withEmbeddingModelId("text-embedding-3-small")
            .withEmbeddingDimension(1536)
            .withEndpoint("http://localhost:1");

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);
    assertThrows(RuntimeException.class, () -> client.embed("test text"));
  }

  @Test
  void testCustomEndpointWithoutDeployment() {
    Openai openaiCfg =
        new Openai()
            .withApiKey("test-key")
            .withEmbeddingModelId("text-embedding-3-small")
            .withEmbeddingDimension(1536)
            .withEndpoint("https://custom.api.example.com");

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);
    assertNotNull(client);
    assertEquals(1536, client.getDimension());
  }

  private ElasticSearchConfiguration buildConfig(String apiKey, String modelId, int dimension) {
    Openai openaiCfg =
        new Openai()
            .withApiKey(apiKey)
            .withEmbeddingModelId(modelId)
            .withEmbeddingDimension(dimension);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);
    return config;
  }
}
