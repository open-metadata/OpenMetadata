package org.openmetadata.service.search.vector;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;

public interface VectorIndexService {

  String VECTOR_EMBEDDING_ALIAS = "dataAssetEmbeddings";

  Map<String, Object> generateEmbeddingFields(EntityInterface entity);

  Map<String, Object> generateColumnEmbeddingFields(Column column, Table parentTable);

  void updateEntityEmbedding(EntityInterface entity, String entityIndexName);

  void updateColumnEmbedding(Column column, Table parentTable, String columnIndexName);

  void refreshTableColumnEmbeddings(Table table, String columnIndexName);

  VectorSearchResponse search(
      String query, Map<String, List<String>> filters, int size, int from, int k, double threshold);
}
