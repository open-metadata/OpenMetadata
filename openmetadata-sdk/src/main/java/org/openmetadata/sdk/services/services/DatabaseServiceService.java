package org.openmetadata.sdk.services.services;

import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DatabaseServiceService
    extends EntityServiceBase<org.openmetadata.schema.entity.services.DatabaseService> {

  public DatabaseServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/databaseServices");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.DatabaseService> getEntityClass() {
    return org.openmetadata.schema.entity.services.DatabaseService.class;
  }
}
