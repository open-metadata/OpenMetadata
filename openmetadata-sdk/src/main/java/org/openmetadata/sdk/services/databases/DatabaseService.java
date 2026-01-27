package org.openmetadata.sdk.services.databases;

import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DatabaseService extends EntityServiceBase<Database> {
  public DatabaseService(HttpClient httpClient) {
    super(httpClient, "/v1/databases");
  }

  @Override
  protected Class<Database> getEntityClass() {
    return Database.class;
  }

  // Create database using CreateDatabase request
  public Database create(CreateDatabase request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Database.class);
  }
}
