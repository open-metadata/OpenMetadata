package org.openmetadata.service.search.vector.client;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
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
 *
 * <p>Every document that carries a vector also records the model that produced it, beside the
 * vector: two models place the same text at unrelated points even when their vectors have the same
 * size, so a stored vector is reusable only for the model that made it
 * (ADR:2026-11-11-reindex-reuses-an-embedding-only-when-its-fingerprint-matches).
 */
public record EmbeddingModel(String id, int dimension) {
  public static final String ID_FIELD = "embeddingModel";
  public static final String DIMENSION_FIELD = "embeddingDimension";
  public static final List<String> FIELDS = List.of(ID_FIELD, DIMENSION_FIELD);

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

  /**
   * The model {@code document} records for its vector, or empty when it records none: it was
   * written before vectors recorded their model, so no configured model can be known to match it.
   */
  public static Optional<EmbeddingModel> recordedOn(JsonNode document) {
    JsonNode recordedId = document.path(ID_FIELD);
    JsonNode recordedDimension = document.path(DIMENSION_FIELD);
    boolean recorded = recordedId.isTextual() && recordedDimension.canConvertToInt();
    return recorded
        ? Optional.of(new EmbeddingModel(recordedId.asText(), recordedDimension.asInt()))
        : Optional.empty();
  }

  /** Whether this model produced the vector of {@code document}. */
  public boolean produced(JsonNode document) {
    return recordedOn(document).filter(this::equals).isPresent();
  }

  /** Records this model on a document whose vector it produced. */
  public void recordOn(Map<String, Object> document) {
    document.put(ID_FIELD, id);
    document.put(DIMENSION_FIELD, dimension);
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
