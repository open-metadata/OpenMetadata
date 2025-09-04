package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class MetricService extends EntityServiceBase<Metric> {
  public MetricService(HttpClient httpClient) {
    super(httpClient, "/v1/metrics");
  }

  @Override
  protected Class<Metric> getEntityClass() {
    return Metric.class;
  }
}
