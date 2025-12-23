package org.openmetadata.sdk.services.storages;

import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class SpreadsheetService extends EntityServiceBase<Spreadsheet> {
  public SpreadsheetService(HttpClient httpClient) {
    super(httpClient, "/v1/spreadsheets");
  }

  @Override
  protected Class<Spreadsheet> getEntityClass() {
    return Spreadsheet.class;
  }

  public Spreadsheet create(CreateSpreadsheet request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Spreadsheet.class);
  }
}
