package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TableService extends EntityServiceBase<Table> {
  public TableService(HttpClient httpClient) {
    super(httpClient, "/v1/tables");
  }

  @Override
  protected Class<Table> getEntityClass() {
    return Table.class;
  }
}
