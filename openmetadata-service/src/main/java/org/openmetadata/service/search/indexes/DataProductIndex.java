package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public record DataProductIndex(DataProduct dataProduct) implements SearchIndex {
  // Only exclude assets - inputPorts and outputPorts are indexed
  private static final Set<String> excludeFields = Set.of("assets");

  @Override
  public Object getEntity() {
    return dataProduct;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(dataProduct, Entity.DATA_PRODUCT);
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.DATA_PRODUCT, dataProduct));
    doc.put("tags", parseTags.getTags());
    doc.put("classificationTags", parseTags.getClassificationTags());
    doc.put("glossaryTags", parseTags.getGlossaryTags());
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(dataProduct.getEntityReference()));
    doc.put("inputPorts", getEntitiesWithDisplayName(dataProduct.getInputPorts()));
    doc.put("outputPorts", getEntitiesWithDisplayName(dataProduct.getOutputPorts()));
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
