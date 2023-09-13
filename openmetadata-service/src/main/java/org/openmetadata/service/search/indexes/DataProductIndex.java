package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.JsonUtils;

public class DataProductIndex implements ElasticSearchIndex {

  private static final List<String> excludeFields = List.of("changeDescription");

  final DataProduct dataProduct;

  public DataProductIndex(DataProduct dataProduct) {
    this.dataProduct = dataProduct;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(dataProduct);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }
}
