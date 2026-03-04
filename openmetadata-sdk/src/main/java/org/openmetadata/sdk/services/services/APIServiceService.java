package org.openmetadata.sdk.services.services;

import org.openmetadata.schema.api.services.CreateApiService;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class APIServiceService extends EntityServiceBase<ApiService> {

  public APIServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/apiServices");
  }

  @Override
  protected Class<ApiService> getEntityClass() {
    return ApiService.class;
  }

  public ApiService create(CreateApiService request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, ApiService.class);
  }
}
