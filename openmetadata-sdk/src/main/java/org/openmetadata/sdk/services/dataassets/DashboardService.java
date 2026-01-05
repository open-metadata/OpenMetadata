package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DashboardService extends EntityServiceBase<Dashboard> {
  public DashboardService(HttpClient httpClient) {
    super(httpClient, "/v1/dashboards");
  }

  @Override
  protected Class<Dashboard> getEntityClass() {
    return Dashboard.class;
  }

  // Create using CreateDashboard request
  public Dashboard create(CreateDashboard request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Dashboard.class);
  }
}
