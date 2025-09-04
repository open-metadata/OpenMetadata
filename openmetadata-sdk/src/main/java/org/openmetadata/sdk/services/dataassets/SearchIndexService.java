package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class SearchIndexService extends EntityServiceBase<SearchIndex> {
  public SearchIndexService(HttpClient httpClient) {
    super(httpClient, "/v1/searchIndexes");
  }

  @Override
  protected Class<SearchIndex> getEntityClass() {
    return SearchIndex.class;
  }
}
