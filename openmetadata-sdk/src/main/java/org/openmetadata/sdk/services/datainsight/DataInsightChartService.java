package org.openmetadata.sdk.services.datainsight;

import org.openmetadata.schema.api.dataInsight.CreateDataInsightChart;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DataInsightChartService extends EntityServiceBase<DataInsightChart> {
  public DataInsightChartService(HttpClient httpClient) {
    super(httpClient, "/v1/analytics/dataInsights/charts");
  }

  @Override
  protected Class<DataInsightChart> getEntityClass() {
    return DataInsightChart.class;
  }

  public DataInsightChart create(CreateDataInsightChart request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, DataInsightChart.class);
  }

  // Use base class update method which does proper JSON Patch
}
