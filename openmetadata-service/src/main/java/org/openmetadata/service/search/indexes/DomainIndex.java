package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.models.SearchSuggest;

@Slf4j
public record DomainIndex(Domain domain) implements SearchIndex {

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(domain.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(domain.getFullyQualifiedName()).weight(5).build());
    return suggest;
  }

  @Override
  public Object getEntity() {
    return domain;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(domain, Entity.DOMAIN);
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.DOMAIN, domain));
    doc.putAll(commonAttributes);
    doc.put("tags", parseTags.getTags());
    doc.put("upstreamLineage", SearchIndex.getLineageData(domain.getEntityReference()));
    LOG.info("Building search index doc for domain: {}", domain.getName());
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
