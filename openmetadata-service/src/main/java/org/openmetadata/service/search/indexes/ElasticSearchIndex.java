package org.openmetadata.service.search.indexes;

import java.util.Map;

public interface ElasticSearchIndex {
  Map<String, Object> buildESDoc();
}
