package org.openmetadata.sdk.services.databases;

import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DatabaseSchemaService extends EntityServiceBase<DatabaseSchema> {
  public DatabaseSchemaService(HttpClient httpClient) {
    super(httpClient, "/v1/databaseSchemas");
  }

  @Override
  protected Class<DatabaseSchema> getEntityClass() {
    return DatabaseSchema.class;
  }
}
