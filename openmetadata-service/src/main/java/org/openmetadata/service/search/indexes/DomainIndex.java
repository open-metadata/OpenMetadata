package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.JsonUtils;

public class DomainIndex implements ElasticSearchIndex {

  private static final List<String> excludeFields = List.of("changeDescription");

  final Domain domain;

  public DomainIndex(Domain domain) {
    this.domain = domain;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(domain);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }
}
