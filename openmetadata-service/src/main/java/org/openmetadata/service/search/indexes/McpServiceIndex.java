package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.service.Entity;

public record McpServiceIndex(McpService mcpService) implements TaggableIndex, LineageIndex {

  @Override
  public Object getEntity() {
    return mcpService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.MCP_SERVICE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
