package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public record DataProductIndex(DataProduct dataProduct) implements SearchIndex {
  @Override
  public Object getEntity() {
    return dataProduct;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(dataProduct, Entity.DATA_PRODUCT);
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.DATA_PRODUCT, dataProduct));
    doc.put("tags", parseTags.getTags());
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(dataProduct.getEntityReference()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
