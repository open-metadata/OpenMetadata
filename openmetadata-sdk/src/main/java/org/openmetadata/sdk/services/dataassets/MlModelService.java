package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class MlModelService extends EntityServiceBase<MlModel> {
  public MlModelService(HttpClient httpClient) {
    super(httpClient, "/v1/mlmodels");
  }

  @Override
  protected Class<MlModel> getEntityClass() {
    return MlModel.class;
  }
}
