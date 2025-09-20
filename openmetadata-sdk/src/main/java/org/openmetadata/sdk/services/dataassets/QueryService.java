package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class QueryService extends EntityServiceBase<Query> {
  public QueryService(HttpClient httpClient) {
    super(httpClient, "/v1/queries");
  }

  @Override
  protected Class<Query> getEntityClass() {
    return Query.class;
  }

  // Create query using CreateQuery request
  public Query create(CreateQuery request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Query.class);
  }
}
