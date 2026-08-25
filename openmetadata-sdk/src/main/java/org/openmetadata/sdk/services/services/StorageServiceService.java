package org.openmetadata.sdk.services.services;

import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class StorageServiceService
    extends EntityServiceBase<org.openmetadata.schema.entity.services.StorageService> {

  public StorageServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/storageServices");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.StorageService> getEntityClass() {
    return org.openmetadata.schema.entity.services.StorageService.class;
  }

  // Create using CreateStorageService request
  public org.openmetadata.schema.entity.services.StorageService create(CreateStorageService request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        basePath,
        request,
        org.openmetadata.schema.entity.services.StorageService.class);
  }
}
