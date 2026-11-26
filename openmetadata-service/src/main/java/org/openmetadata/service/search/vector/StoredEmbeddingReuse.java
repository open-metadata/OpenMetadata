package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.vector.client.EmbeddingModel;

/**
 * When an embedding stored on an entity search doc may be kept instead of calling the embedding
 * provider: by a reindex, which copies it into the rebuilt doc, and by a live write, which then
 * skips the entity. The vector index service selects stored embeddings by these rules and the
 * reindex bulk sinks check them again where they splice.
 *
 * <p>A stored embedding is current when two separate facts hold: its fingerprint is the fingerprint
 * of the entity's current text, and the model it records is the configured model. An unchanged
 * {@code updatedAt} is not enough, since a release that changes the embedding text leaves every
 * {@code updatedAt} as it was, and a switch of model changes no text at all.
 * ADR:2026-11-11-reindex-reuses-an-embedding-only-when-its-fingerprint-matches
 */
@Slf4j
public final class StoredEmbeddingReuse {

  static final String FINGERPRINT_FIELD = "fingerprint";
  static final List<String> HEADER_FIELDS =
      List.of(FINGERPRINT_FIELD, EmbeddingModel.ID_FIELD, EmbeddingModel.DIMENSION_FIELD);

  private StoredEmbeddingReuse() {}

  /**
   * Whether {@code header} records an embedding of {@code model} for the entity's current text. The
   * current fingerprint is computed only for a doc that records {@code model}.
   */
  static boolean isCurrent(
      String entityId, JsonNode header, EmbeddingModel model, Supplier<String> currentFingerprint) {
    return model.produced(header) && fingerprintMatches(entityId, header, currentFingerprint);
  }

  /** The current fingerprint is computed only for entities that have a stored fingerprint. */
  static boolean fingerprintMatches(
      String entityId, JsonNode header, Supplier<String> currentFingerprint) {
    String storedFingerprint = header.path(FINGERPRINT_FIELD).asText(null);
    return storedFingerprint != null
        && storedFingerprint.equals(currentFingerprintOrNull(entityId, currentFingerprint));
  }

  // The lookup runs for a whole batch; one entity whose text cannot be built must cost only its
  // own reuse, not every other entity's in the batch.
  private static String currentFingerprintOrNull(
      String entityId, Supplier<String> currentFingerprint) {
    String fingerprint;
    try {
      fingerprint = currentFingerprint.get();
    } catch (RuntimeException e) {
      LOG.warn("Cannot fingerprint entity {}; re-embedding it: {}", entityId, e.getMessage());
      fingerprint = null;
    }
    return fingerprint;
  }

  /**
   * The splice-site contract: a JSON object whose {@code embedding} is a non-empty array and whose
   * {@code fingerprint} is non-blank text. Anything else is a corrupt or partial cached doc that the
   * caller regenerates.
   */
  static boolean isSpliceable(JsonNode cached) {
    return cached != null
        && cached.isObject()
        && hasEmbedding(cached)
        && cached.path(FINGERPRINT_FIELD).isTextual()
        && !cached.path(FINGERPRINT_FIELD).asText().isBlank();
  }

  /**
   * As {@link #isSpliceable(JsonNode)}, into an index of {@code model}'s vectors: the doc records
   * {@code model}, and its vector has that model's dimension.
   */
  public static boolean isSpliceable(JsonNode cached, EmbeddingModel model) {
    return isSpliceable(cached)
        && model.produced(cached)
        && cached.path("embedding").size() == model.dimension();
  }

  private static boolean hasEmbedding(JsonNode cached) {
    JsonNode embedding = cached.path("embedding");
    return embedding.isArray() && !embedding.isEmpty();
  }
}
