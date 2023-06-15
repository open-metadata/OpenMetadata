package org.openmetadata.service.elasticsearch.indexes;

import java.util.Map;

public interface ElasticSearchIndex {
  Map<String, Object> buildESDoc();
}
