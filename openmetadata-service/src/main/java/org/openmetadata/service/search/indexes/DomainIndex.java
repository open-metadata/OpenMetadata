package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

@Slf4j
public record DomainIndex(Domain domain) implements SearchIndex {
  private static final Set<String> excludeFields = Set.of("assets");

  @Override
  public Object getEntity() {
    return domain;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(domain, Entity.DOMAIN);
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.DOMAIN, domain));
    doc.putAll(commonAttributes);
    doc.put("tags", parseTags.getTags());
    doc.put("classificationTags", parseTags.getClassificationTags());
    doc.put("glossaryTags", parseTags.getGlossaryTags());
    doc.put("upstreamLineage", SearchIndex.getLineageData(domain.getEntityReference()));
    return doc;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
