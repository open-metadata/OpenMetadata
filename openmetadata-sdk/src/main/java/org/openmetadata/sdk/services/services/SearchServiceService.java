package org.openmetadata.sdk.services.services;

import org.openmetadata.sdk.network.HttpClient;
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
}
