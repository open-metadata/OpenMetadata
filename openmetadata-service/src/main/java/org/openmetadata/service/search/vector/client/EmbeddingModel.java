package org.openmetadata.service.search.vector.client;

import java.util.Optional;
import org.openmetadata.schema.configuration.LLMBedrockEmbeddingConfig;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMEmbeddingsConfig;
import org.openmetadata.schema.configuration.LLMGoogleEmbeddingConfig;
import org.openmetadata.schema.configuration.LLMOpenAIEmbeddingConfig;

/**
 * The embedding model search indexes are built for: its id and the dimension of its vectors.
 * Bedrock, OpenAI and Google models take both from the configuration, so indexes get the right
 * vector field before any embedding client exists and without the provider's credentials; a DJL
 * model knows its dimension only once it is loaded
 * (ADR:2026-11-26-the-server-reconciles-live-vector-fields-with-the-embedding-model).
 */
public record EmbeddingModel(String id, int dimension) {

  public static EmbeddingModel of(EmbeddingClient client) {
    return new EmbeddingModel(client.getModelId(), client.getDimension());
  }

  /**
   * The model the configuration names, read from the configuration alone; empty for a DJL model.
   *
   * @throws IllegalArgumentException when the configuration names no valid model, with the message
   *     the provider's embedding client fails with
   */
  public static Optional<EmbeddingModel> fromConfiguration(LLMConfiguration config) {
    LLMEmbeddingsConfig embeddings = config == null ? null : config.getEmbeddings();
    LLMEmbeddingsConfig.Provider provider =
        embeddings == null || embeddings.getProvider() == null
            ? LLMEmbeddingsConfig.Provider.BEDROCK
            : embeddings.getProvider();
    return switch (provider) {
      case BEDROCK -> Optional.of(bedrock(embeddings == null ? null : embeddings.getBedrock()));
      case OPENAI -> Optional.of(openAi(embeddings.getOpenai()));
      case GOOGLE -> Optional.of(google(embeddings.getGoogle()));
      case DJL -> Optional.empty();
    };
  }

  static EmbeddingModel bedrock(LLMBedrockEmbeddingConfig config) {
    if (config == null) {
      throw new IllegalArgumentException("Bedrock configuration is required");
    }
    EmbeddingModel model =
        configured("Bedrock", config.getEmbeddingModelId(), config.getEmbeddingDimension());
    BedrockEmbeddingClient.validateDimension(
        BedrockEmbeddingClient.familyFor(model.id()), model.dimension());
    return model;
  }

  static EmbeddingModel openAi(LLMOpenAIEmbeddingConfig config) {
    if (config == null) {
      throw new IllegalArgumentException("OpenAI configuration is required");
    }
    return configured("OpenAI", config.getEmbeddingModelId(), config.getEmbeddingDimension());
  }

  static EmbeddingModel google(LLMGoogleEmbeddingConfig config) {
    if (config == null) {
      throw new IllegalArgumentException("Google configuration is required");
    }
    return configured("Google", config.getEmbeddingModelId(), config.getEmbeddingDimension());
  }

  private static EmbeddingModel configured(String provider, String id, Integer dimension) {
    if (id == null || id.isBlank()) {
      throw new IllegalArgumentException(provider + " embedding model ID is required");
    }
    if (dimension == null || dimension <= 0) {
      throw new IllegalArgumentException(provider + " embedding dimension must be positive");
    }
    return new EmbeddingModel(id, dimension);
  }
}
