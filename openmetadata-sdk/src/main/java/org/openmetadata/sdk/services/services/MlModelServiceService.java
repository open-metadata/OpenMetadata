package org.openmetadata.sdk.services.services;

import org.openmetadata.sdk.network.HttpClient;
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
}
