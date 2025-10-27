package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TableService extends EntityServiceBase<Table> {
  public TableService(HttpClient httpClient) {
    super(httpClient, "/v1/tables");
  }

  @Override
  protected Class<Table> getEntityClass() {
    return Table.class;
  }

  // Create table using CreateTable request
  public Table create(CreateTable request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Table.class);
  }
}
