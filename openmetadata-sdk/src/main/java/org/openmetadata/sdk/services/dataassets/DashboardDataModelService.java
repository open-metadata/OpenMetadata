package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DashboardDataModelService extends EntityServiceBase<DashboardDataModel> {
  public DashboardDataModelService(HttpClient httpClient) {
    super(httpClient, "/v1/dashboardDataModels");
  }

  @Override
  protected Class<DashboardDataModel> getEntityClass() {
    return DashboardDataModel.class;
  }

  // Create dashboarddatamodel using CreateDashboardDataModel request
  public DashboardDataModel create(CreateDashboardDataModel request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, DashboardDataModel.class);
  }
}
