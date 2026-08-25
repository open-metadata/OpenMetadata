package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class SearchIndexService extends EntityServiceBase<SearchIndex> {
  public SearchIndexService(HttpClient httpClient) {
    super(httpClient, "/v1/searchIndexes");
  }

  @Override
  protected Class<SearchIndex> getEntityClass() {
    return SearchIndex.class;
  }

  // Create searchindex using CreateSearchIndex request
  public SearchIndex create(CreateSearchIndex request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, SearchIndex.class);
  }
}
