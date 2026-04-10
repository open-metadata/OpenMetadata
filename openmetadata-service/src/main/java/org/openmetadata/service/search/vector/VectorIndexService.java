package org.openmetadata.service.search.vector;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;

public interface VectorIndexService {

  String VECTOR_EMBEDDING_ALIAS = "dataAssetEmbeddings";
  String VECTOR_INDEX_KEY = "vectorEmbeddings";

  Map<String, Object> generateEmbeddingFields(EntityInterface entity);

  void updateEntityEmbedding(EntityInterface entity, String entityIndexName);

  VectorSearchResponse search(
      String query, Map<String, List<String>> filters, int size, int from, int k, double threshold);

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
