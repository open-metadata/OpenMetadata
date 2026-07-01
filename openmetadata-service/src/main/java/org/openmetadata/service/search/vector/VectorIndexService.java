package org.openmetadata.service.search.vector;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;

public interface VectorIndexService {

  String VECTOR_EMBEDDING_ALIAS = "dataAssetEmbeddings";

  Map<String, Object> generateEmbeddingFields(EntityInterface entity);

  void updateEntityEmbedding(EntityInterface entity, String entityIndexName);

  /**
   * Multi-chunk write path (issue #4789): index one document per body chunk into the dedicated
   * chunk index so long articles are fully retrievable. Default is a no-op for backends without
   * chunk support.
   */
  default void updateEntityEmbeddingChunks(EntityInterface entity) {}

  /** Remove all chunk documents for the given parent entity (hard/soft delete cleanup). */
  default void deleteEntityChunks(String parentId) {}

  default VectorSearchResponse search(
      String query,
      Map<String, List<String>> filters,
      int size,
      int from,
      int k,
      double threshold) {
    return search(query, filters, size, from, k, threshold, null);
  }

  VectorSearchResponse search(
      String query,
      Map<String, List<String>> filters,
      int size,
      int from,
      int k,
      double threshold,
      String preference);
}
