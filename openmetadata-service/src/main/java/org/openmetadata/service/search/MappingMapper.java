package org.openmetadata.service.search;

import java.util.HashMap;
import java.util.Map;
import lombok.Getter;

@Getter
public class MappingMapper {
  Map<String, Map<String, Object>> mapping = new HashMap<>();

  public void fromElasticsearch(
      Map<String, es.org.elasticsearch.cluster.metadata.MappingMetadata> mapping) {
    for (Map.Entry<String, es.org.elasticsearch.cluster.metadata.MappingMetadata> entry :
        mapping.entrySet()) {
      this.mapping.put(entry.getKey(), entry.getValue().getSourceAsMap());
    }
  }

  public void fromOpenSearch(
      Map<String, os.org.opensearch.cluster.metadata.MappingMetadata> mapping) {
    for (Map.Entry<String, os.org.opensearch.cluster.metadata.MappingMetadata> entry :
        mapping.entrySet()) {
      this.mapping.put(entry.getKey(), entry.getValue().getSourceAsMap());
    }
  }
}
