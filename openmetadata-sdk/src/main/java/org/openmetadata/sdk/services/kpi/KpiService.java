package org.openmetadata.sdk.services.kpi;

import org.openmetadata.schema.api.dataInsight.kpi.CreateKpiRequest;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class KpiService extends EntityServiceBase<Kpi> {
  public KpiService(HttpClient httpClient) {
    super(httpClient, "/v1/kpi");
  }

  @Override
  protected Class<Kpi> getEntityClass() {
    return Kpi.class;
  }

  public Kpi create(CreateKpiRequest request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Kpi.class);
  }

  @Override
  public Kpi update(String id, Kpi entity) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath, entity, Kpi.class);
  }
}
