package org.openmetadata.service.search.vector;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

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

  /**
   * Strip the embedding fields from an entity document. Entity-doc embedding writes are partial
   * merges, so an entity whose repository stops considering it embeddable would otherwise keep a
   * stale {@code embedding} and stay matchable by kNN. Default is a no-op for backends without the
   * legacy entity-doc embedding.
   */
  default void clearEntityEmbedding(String entityIndexName, String entityId) {}

  /**
   * Combined write: refresh both the legacy entity-doc embedding (read by hybrid search) and the
   * chunk documents (read by the semantic vector path). Implementations should embed each chunk
   * once and reuse chunk 0 for the entity doc; this default simply chains the two writes.
   */
  default void updateEntityEmbeddings(EntityInterface entity, String entityIndexName) {
    updateEntityEmbedding(entity, entityIndexName);
    updateEntityEmbeddingChunks(entity);
  }

  default VectorSearchResponse search(
      String query,
      Map<String, List<String>> filters,
      int size,
      int from,
      int k,
      double threshold) {
    return search(query, filters, size, from, k, threshold, null);
  }

  default VectorSearchResponse search(
      String query,
      Map<String, List<String>> filters,
      int size,
      int from,
      int k,
      double threshold,
      String preference) {
    return search(query, filters, size, from, k, threshold, preference, null);
  }

  /**
   * As above, resolving context memory visibility for {@code subjectContext}. A null subject is
   * fail-closed: only org-wide memories match, so a caller that cannot identify its user never sees
   * a restricted one. Callers whose filters already exclude memories can leave it null.
   */
  VectorSearchResponse search(
      String query,
      Map<String, List<String>> filters,
      int size,
      int from,
      int k,
      double threshold,
      String preference,
      SubjectContext subjectContext);

  String getExistingFingerprint(String indexName, String entityId);

  Map<String, String> getExistingFingerprintsBatch(String indexName, List<String> entityIds);

  String executeGenericRequest(String method, String endpoint, String body);

  default String getIndexAlias() {
    try {
      String clusterAlias = Entity.getSearchRepository().getClusterAlias();
      if (clusterAlias == null || clusterAlias.isEmpty()) {
        return VECTOR_EMBEDDING_ALIAS;
      }
      return clusterAlias + "_" + VECTOR_EMBEDDING_ALIAS;
    } catch (Exception ex) {
      return VECTOR_EMBEDDING_ALIAS;
    }
  }
}
