package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.entity.data.Report;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class ReportService extends EntityServiceBase<Report> {
  public ReportService(HttpClient httpClient) {
    super(httpClient, "/v1/reports");
  }

  @Override
  protected Class<Report> getEntityClass() {
    return Report.class;
  }
}
