package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public class McpServerIndex implements SearchIndex {
  final McpServer mcpServer;

  public McpServerIndex(McpServer mcpServer) {
    this.mcpServer = mcpServer;
  }

  @Override
  public Object getEntity() {
    return mcpServer;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.MCP_SERVER, mcpServer));
    Map<String, Object> commonAttributes = getCommonAttributesMap(mcpServer, Entity.MCP_SERVER);
    doc.putAll(commonAttributes);
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("upstreamLineage", SearchIndex.getLineageData(mcpServer.getEntityReference()));
    return doc;
  }
}
