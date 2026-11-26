package org.openmetadata.service.search.vector.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.LLMBedrockEmbeddingConfig;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMDjlEmbeddingConfig;
import org.openmetadata.schema.configuration.LLMEmbeddingsConfig;
import org.openmetadata.schema.configuration.LLMGoogleEmbeddingConfig;
import org.openmetadata.schema.configuration.LLMOpenAIEmbeddingConfig;

/**
 * The model indexes are built for is read from the configuration alone, so {@code migrate} and
 * server start know it before any embedding client exists and without the provider's credentials.
 */
class EmbeddingModelTest {

  private static LLMConfiguration withEmbeddings(LLMEmbeddingsConfig embeddings) {
    return new LLMConfiguration().withEmbeddings(embeddings);
  }

  @Test
  void openAiReadsItsModelAndDimensionWithoutAnApiKey() {
    LLMConfiguration config =
        withEmbeddings(
            new LLMEmbeddingsConfig()
                .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                .withOpenai(
                    new LLMOpenAIEmbeddingConfig()
                        .withEmbeddingModelId("text-embedding-3-small")
                        .withEmbeddingDimension(1536)));

    assertEquals(
        Optional.of(new EmbeddingModel("text-embedding-3-small", 1536)),
        EmbeddingModel.fromConfiguration(config));
  }

  @Test
  void googleReadsItsModelAndDimensionWithoutAnApiKey() {
    LLMConfiguration config =
        withEmbeddings(
            new LLMEmbeddingsConfig()
                .withProvider(LLMEmbeddingsConfig.Provider.GOOGLE)
                .withGoogle(
                    new LLMGoogleEmbeddingConfig()
                        .withEmbeddingModelId("gemini-embedding-001")
                        .withEmbeddingDimension(768)));

    assertEquals(
        Optional.of(new EmbeddingModel("gemini-embedding-001", 768)),
        EmbeddingModel.fromConfiguration(config));
  }

  @Test
  void bedrockIsTheDefaultProviderAndNeedsNoAwsRegion() {
    LLMConfiguration config =
        withEmbeddings(
            new LLMEmbeddingsConfig()
                .withBedrock(
                    new LLMBedrockEmbeddingConfig()
                        .withEmbeddingModelId("amazon.titan-embed-text-v2:0")
                        .withEmbeddingDimension(512)));

    assertEquals(
        Optional.of(new EmbeddingModel("amazon.titan-embed-text-v2:0", 512)),
        EmbeddingModel.fromConfiguration(config));
  }

  @Test
  void aBedrockModelOfAFixedDimensionRefusesAnotherOneAsItsClientDoes() {
    LLMConfiguration config =
        withEmbeddings(
            new LLMEmbeddingsConfig()
                .withBedrock(
                    new LLMBedrockEmbeddingConfig()
                        .withEmbeddingModelId("cohere.embed-english-v3")
                        .withEmbeddingDimension(512)));

    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class, () -> EmbeddingModel.fromConfiguration(config));
    assertTrue(error.getMessage().contains("1024"), error.getMessage());
  }

  @Test
  void aDjlModelKnowsItsDimensionOnlyOnceLoaded() {
    LLMConfiguration config =
        withEmbeddings(
            new LLMEmbeddingsConfig()
                .withProvider(LLMEmbeddingsConfig.Provider.DJL)
                .withDjl(new LLMDjlEmbeddingConfig()));

    assertTrue(EmbeddingModel.fromConfiguration(config).isEmpty());
  }

  @Test
  void aMissingModelIdOrDimensionFailsWithTheClientsMessage() {
    LLMConfiguration noModel =
        withEmbeddings(
            new LLMEmbeddingsConfig()
                .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                .withOpenai(
                    new LLMOpenAIEmbeddingConfig()
                        .withEmbeddingModelId(" ")
                        .withEmbeddingDimension(1536)));
    LLMConfiguration noDimension =
        withEmbeddings(
            new LLMEmbeddingsConfig()
                .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                .withOpenai(
                    new LLMOpenAIEmbeddingConfig()
                        .withEmbeddingModelId("m")
                        .withEmbeddingDimension(0)));

    assertEquals(
        "OpenAI embedding model ID is required",
        assertThrows(
                IllegalArgumentException.class, () -> EmbeddingModel.fromConfiguration(noModel))
            .getMessage());
    assertEquals(
        "OpenAI embedding dimension must be positive",
        assertThrows(
                IllegalArgumentException.class, () -> EmbeddingModel.fromConfiguration(noDimension))
            .getMessage());
    assertEquals(
        "Bedrock configuration is required",
        assertThrows(IllegalArgumentException.class, () -> EmbeddingModel.fromConfiguration(null))
            .getMessage());
  }
}
