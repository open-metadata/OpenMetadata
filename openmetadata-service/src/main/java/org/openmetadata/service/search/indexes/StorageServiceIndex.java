package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.JsonUtils;

public class StorageServiceIndex implements ElasticSearchIndex {

  final StorageService storageService;

  private static final List<String> excludeFields = List.of("changeDescription");

  public StorageServiceIndex(StorageService storageService) {
    this.storageService = storageService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(storageService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }
}
