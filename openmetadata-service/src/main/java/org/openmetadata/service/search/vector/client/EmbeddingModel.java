package org.openmetadata.service.search.vector.client;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Which model produced a vector: the provider's model id and the vector's dimension. Two models
 * place the same text at unrelated points even when their vectors have the same size, and one model
 * id can be configured for several sizes, so a stored vector is comparable with, and reusable for,
 * only the model that produced it. Every document that carries a vector records it beside the
 * vector, the entity documents and the chunk documents alike.
 * ADR:2026-11-11-reindex-reuses-an-embedding-only-when-its-fingerprint-matches
 */
public record EmbeddingModel(String id, int dimension) {
  public static final String ID_FIELD = "embeddingModel";
  public static final String DIMENSION_FIELD = "embeddingDimension";
  public static final List<String> FIELDS = List.of(ID_FIELD, DIMENSION_FIELD);

  /** The model {@code client} embeds with. */
  public static EmbeddingModel of(EmbeddingClient client) {
    return new EmbeddingModel(client.getModelId(), client.getDimension());
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
}
