package org.openmetadata.sdk.services.services;

import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class APIServiceService
    extends EntityServiceBase<org.openmetadata.schema.entity.services.ApiService> {

  public APIServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/apiServices");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.ApiService> getEntityClass() {
    return org.openmetadata.schema.entity.services.ApiService.class;
  }
}
