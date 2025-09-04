package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DashboardDataModelService extends EntityServiceBase<DashboardDataModel> {
  public DashboardDataModelService(HttpClient httpClient) {
    super(httpClient, "/v1/dashboardDataModels");
  }

  @Override
  protected Class<DashboardDataModel> getEntityClass() {
    return DashboardDataModel.class;
  }
}
