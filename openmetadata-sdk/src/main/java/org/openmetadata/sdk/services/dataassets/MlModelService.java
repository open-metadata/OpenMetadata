package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class MlModelService extends EntityServiceBase<MlModel> {
  public MlModelService(HttpClient httpClient) {
    super(httpClient, "/v1/mlmodels");
  }

  @Override
  protected Class<MlModel> getEntityClass() {
    return MlModel.class;
  }

  // Create mlmodel using CreateMlModel request
  public MlModel create(CreateMlModel request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, MlModel.class);
  }
}
