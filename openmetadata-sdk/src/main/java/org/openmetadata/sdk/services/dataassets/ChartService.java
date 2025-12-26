package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class ChartService extends EntityServiceBase<Chart> {
  public ChartService(HttpClient httpClient) {
    super(httpClient, "/v1/charts");
  }

  @Override
  protected Class<Chart> getEntityClass() {
    return Chart.class;
  }

  // Create chart using CreateChart request
  public Chart create(CreateChart request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Chart.class);
  }
}
