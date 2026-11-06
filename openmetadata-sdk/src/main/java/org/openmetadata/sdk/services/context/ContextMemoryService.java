package org.openmetadata.sdk.services.context;

import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class ContextMemoryService extends EntityServiceBase<ContextMemory> {
  public ContextMemoryService(HttpClient httpClient) {
    super(httpClient, "/v1/contextCenter/memories");
  }

  @Override
  protected Class<ContextMemory> getEntityClass() {
    return ContextMemory.class;
  }

  public ContextMemory create(CreateContextMemory request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, ContextMemory.class);
  }

  public ContextMemory put(CreateContextMemory request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath, request, ContextMemory.class);
  }
}
