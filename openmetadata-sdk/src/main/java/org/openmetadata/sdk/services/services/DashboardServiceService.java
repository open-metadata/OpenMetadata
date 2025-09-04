package org.openmetadata.sdk.services.services;

import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DashboardServiceService
    extends EntityServiceBase<org.openmetadata.schema.entity.services.DashboardService> {

  public DashboardServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/dashboardServices");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.DashboardService> getEntityClass() {
    return org.openmetadata.schema.entity.services.DashboardService.class;
  }
}
