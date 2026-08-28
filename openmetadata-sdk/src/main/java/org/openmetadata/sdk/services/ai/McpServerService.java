package org.openmetadata.sdk.services.ai;

import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class McpServerService extends EntityServiceBase<McpServer> {

  public McpServerService(HttpClient httpClient) {
    super(httpClient, "/v1/mcpServers");
  }

  @Override
  protected Class<McpServer> getEntityClass() {
    return McpServer.class;
  }

  public McpServer create(CreateMcpServer request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, McpServer.class);
  }
}
