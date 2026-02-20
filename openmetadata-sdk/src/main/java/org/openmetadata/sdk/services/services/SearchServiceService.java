package org.openmetadata.sdk.services.services;

import org.openmetadata.schema.api.services.CreateSearchService;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class SearchServiceService
    extends EntityServiceBase<org.openmetadata.schema.entity.services.SearchService> {

  public SearchServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/searchServices");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.SearchService> getEntityClass() {
    return org.openmetadata.schema.entity.services.SearchService.class;
  }

  // Create using CreateSearchService request
  public org.openmetadata.schema.entity.services.SearchService create(CreateSearchService request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        basePath,
        request,
        org.openmetadata.schema.entity.services.SearchService.class);
  }
}
