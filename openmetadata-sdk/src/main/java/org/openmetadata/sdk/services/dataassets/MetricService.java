package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class MetricService extends EntityServiceBase<Metric> {
  public MetricService(HttpClient httpClient) {
    super(httpClient, "/v1/metrics");
  }

  @Override
  protected Class<Metric> getEntityClass() {
    return Metric.class;
  }

  // Create metric using CreateMetric request
  public Metric create(CreateMetric request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Metric.class);
  }
}
