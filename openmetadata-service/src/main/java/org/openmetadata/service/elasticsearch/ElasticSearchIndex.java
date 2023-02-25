package org.openmetadata.service.elasticsearch;

import java.util.Map;

public interface ElasticSearchIndex {
  Map<String, Object> buildESDoc();
}
