package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record DataProductIndex(DataProduct dataProduct) implements SearchIndex {

  @Override
  public Object getEntity() {
    return dataProduct;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(dataProduct.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(dataProduct.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            dataProduct.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("entityType", Entity.DATA_PRODUCT);
    doc.put("owner", getEntityWithDisplayName(dataProduct.getOwner()));
    doc.put("domain", getEntityWithDisplayName(dataProduct.getDomain()));
    doc.put("followers", SearchIndexUtils.parseFollowers(dataProduct.getFollowers()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
