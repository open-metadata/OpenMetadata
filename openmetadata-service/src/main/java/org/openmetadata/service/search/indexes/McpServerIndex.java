package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.service.Entity;

public class McpServerIndex implements TaggableIndex, LineageIndex {
  final McpServer mcpServer;

  public McpServerIndex(McpServer mcpServer) {
    this.mcpServer = mcpServer;
  }

  @Override
  public Object getEntity() {
    return mcpServer;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.MCP_SERVER;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
