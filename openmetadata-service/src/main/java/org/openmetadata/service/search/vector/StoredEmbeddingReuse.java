package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.function.Supplier;

/**
 * When a reindex may copy the embedding stored on an entity search doc into the rebuilt doc instead
 * of calling the embedding provider. Shared by the OpenSearch and Elasticsearch vector services.
 *
 * <p>The stored fingerprint is the only reuse key. An unchanged {@code updatedAt} is not enough: a
 * release that changes the embedding text leaves every entity's {@code updatedAt} as it was.
 * ADR:2026-11-11-reindex-reuses-an-embedding-only-when-its-fingerprint-matches
 */
final class StoredEmbeddingReuse {

  static final String FINGERPRINT_FIELD = "fingerprint";
  static final List<String> HEADER_FIELDS = List.of(FINGERPRINT_FIELD);

  private StoredEmbeddingReuse() {}

  /** The current fingerprint is computed only for entities that have a stored fingerprint. */
  static boolean fingerprintMatches(JsonNode header, Supplier<String> currentFingerprint) {
    String storedFingerprint = header.path(FINGERPRINT_FIELD).asText(null);
    return storedFingerprint != null && storedFingerprint.equals(currentFingerprint.get());
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

  private static boolean hasEmbedding(JsonNode cached) {
    JsonNode embedding = cached.path("embedding");
    return embedding.isArray() && !embedding.isEmpty();
  }
}
