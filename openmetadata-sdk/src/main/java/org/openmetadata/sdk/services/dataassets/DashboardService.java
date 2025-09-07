package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.resources.BaseResource;

public class DashboardService extends BaseResource<Dashboard> {
  public DashboardService(HttpClient httpClient) {
    super(httpClient, "/v1/dashboards");
  }

  @Override
  protected Class<Dashboard> getEntityClass() {
    return Dashboard.class;
  }
}
