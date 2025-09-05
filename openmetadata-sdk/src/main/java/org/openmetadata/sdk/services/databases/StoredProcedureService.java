package org.openmetadata.sdk.services.databases;

import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class StoredProcedureService extends EntityServiceBase<StoredProcedure> {
  public StoredProcedureService(HttpClient httpClient) {
    super(httpClient, "/v1/storedProcedures");
  }

  @Override
  protected Class<StoredProcedure> getEntityClass() {
    return StoredProcedure.class;
  }
}
