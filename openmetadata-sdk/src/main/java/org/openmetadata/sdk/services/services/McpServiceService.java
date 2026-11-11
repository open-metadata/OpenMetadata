package org.openmetadata.sdk.services.services;

import org.openmetadata.schema.api.services.CreateMcpService;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class McpServiceService extends EntityServiceBase<McpService> {

  public McpServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/mcpServices");
  }

  @Override
  protected Class<McpService> getEntityClass() {
    return McpService.class;
  }

  public McpService create(CreateMcpService request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, McpService.class);
  }
}
