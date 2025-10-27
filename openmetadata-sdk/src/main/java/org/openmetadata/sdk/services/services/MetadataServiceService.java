package org.openmetadata.sdk.services.services;

import org.openmetadata.sdk.network.HttpClient;
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
}
