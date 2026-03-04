package org.openmetadata.service.search.vector;

import static org.openmetadata.search.IndexMapping.INDEX_NAME_SEPARATOR;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;

public interface VectorIndexService {
  String VECTOR_INDEX_KEY = "vectorEmbedding";
  String VECTOR_INDEX_NAME = "vector_search_index";

  static String getClusteredIndexName() {
    try {
      String clusterAlias = Entity.getSearchRepository().getClusterAlias();
      if (clusterAlias == null || clusterAlias.isEmpty()) {
        return VECTOR_INDEX_NAME;
      }
      if (VECTOR_INDEX_NAME.startsWith(clusterAlias + INDEX_NAME_SEPARATOR)) {
        return VECTOR_INDEX_NAME;
      }
      return clusterAlias + INDEX_NAME_SEPARATOR + VECTOR_INDEX_NAME;
    } catch (Exception ex) {
      return VECTOR_INDEX_NAME;
    }
  }

  void updateVectorEmbeddings(EntityInterface entity, String targetIndex);

  void updateVectorEmbeddingsWithMigration(
      EntityInterface entity, String targetIndex, String sourceIndex);

  String getExistingFingerprint(String indexName, String parentId);

  Map<String, String> getExistingFingerprintsBatch(String indexName, List<String> parentIds);

  boolean copyExistingVectorDocuments(
      String sourceIndex, String targetIndex, String parentId, String fingerprint);

  void softDeleteEmbeddings(EntityInterface entity);

  void hardDeleteEmbeddings(EntityInterface entity);

  void restoreEmbeddings(EntityInterface entity);

  VectorSearchResponse search(
      String query, Map<String, List<String>> filters, int size, int k, double threshold);

  void createOrUpdateIndex(int dimension);

  boolean indexExists();

  String getIndexName();

  void bulkIndex(List<Map<String, Object>> documents, String targetIndex);
}
