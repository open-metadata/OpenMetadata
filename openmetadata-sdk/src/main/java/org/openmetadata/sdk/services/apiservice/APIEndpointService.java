package org.openmetadata.sdk.services.apiservice;

import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class APIEndpointService
    extends EntityServiceBase<org.openmetadata.schema.entity.data.APIEndpoint> {

  public APIEndpointService(HttpClient httpClient) {
    super(httpClient, "/v1/apiEndpoints");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.data.APIEndpoint> getEntityClass() {
    return org.openmetadata.schema.entity.data.APIEndpoint.class;
  }
}
