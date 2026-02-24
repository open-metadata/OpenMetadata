package org.openmetadata.sdk.services.apiservice;

import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class APIEndpointService extends EntityServiceBase<APIEndpoint> {

  public APIEndpointService(HttpClient httpClient) {
    super(httpClient, "/v1/apiEndpoints");
  }

  @Override
  protected Class<APIEndpoint> getEntityClass() {
    return APIEndpoint.class;
  }

  public APIEndpoint create(CreateAPIEndpoint request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, APIEndpoint.class);
  }
}
