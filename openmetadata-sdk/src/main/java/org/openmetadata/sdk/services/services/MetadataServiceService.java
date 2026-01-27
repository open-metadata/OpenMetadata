package org.openmetadata.sdk.services.services;

import org.openmetadata.schema.api.services.CreateMetadataService;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class MetadataServiceService
    extends EntityServiceBase<org.openmetadata.schema.entity.services.MetadataService> {

  public MetadataServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/metadataServices");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.MetadataService> getEntityClass() {
    return org.openmetadata.schema.entity.services.MetadataService.class;
  }

  public org.openmetadata.schema.entity.services.MetadataService create(
      CreateMetadataService request) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        basePath,
        request,
        org.openmetadata.schema.entity.services.MetadataService.class);
  }
}
