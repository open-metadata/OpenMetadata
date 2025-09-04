package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class ChartService extends EntityServiceBase<Chart> {
  public ChartService(HttpClient httpClient) {
    super(httpClient, "/v1/charts");
  }

  @Override
  protected Class<Chart> getEntityClass() {
    return Chart.class;
  }
}
