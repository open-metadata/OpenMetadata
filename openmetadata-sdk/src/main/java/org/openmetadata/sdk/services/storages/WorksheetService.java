package org.openmetadata.sdk.services.storages;

import org.openmetadata.schema.api.data.CreateWorksheet;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class WorksheetService extends EntityServiceBase<Worksheet> {
  public WorksheetService(HttpClient httpClient) {
    super(httpClient, "/v1/drives/worksheets");
  }

  @Override
  protected Class<Worksheet> getEntityClass() {
    return Worksheet.class;
  }

  public Worksheet create(CreateWorksheet request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Worksheet.class);
  }
}
