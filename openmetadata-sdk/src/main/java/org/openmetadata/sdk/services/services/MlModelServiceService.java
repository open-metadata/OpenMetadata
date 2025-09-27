package org.openmetadata.sdk.services.services;

import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class MlModelServiceService
    extends EntityServiceBase<org.openmetadata.schema.entity.services.MlModelService> {

  public MlModelServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/mlmodelServices");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.MlModelService> getEntityClass() {
    return org.openmetadata.schema.entity.services.MlModelService.class;
  }

  // Create using CreateMlModelService request
  public org.openmetadata.schema.entity.services.MlModelService create(CreateMlModelService request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        basePath,
        request,
        org.openmetadata.schema.entity.services.MlModelService.class);
  }
}
