package org.openmetadata.service.search.elasticsearch;

import java.util.Set;

/**
 * What an existing Elasticsearch index already maps as its {@code embedding} field: whether any
 * index behind the name maps it, and each dimension declared there. A mapping update leaves a
 * mapped field out of its body (ADR:2026-11-23-elasticsearch-vector-fields-pin-their-index-options).
 */
public record LiveEmbeddingField(boolean mapped, Set<Integer> dimensions) {
  public static final LiveEmbeddingField NOT_MAPPED = new LiveEmbeddingField(false, Set.of());

  public LiveEmbeddingField {
    dimensions = Set.copyOf(dimensions);
  }
}
