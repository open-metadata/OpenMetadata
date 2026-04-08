package org.openmetadata.service.search.indexes;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.entity.ai.McpExecution;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

public record McpExecutionIndex(McpExecution mcpExecution) implements SearchIndex {
  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("@timestamp", mcpExecution.getTimestamp());
    if (mcpExecution.getServerId() != null) {
      doc.put("serverId", mcpExecution.getServerId().toString());
    }
    setParentRelationships(doc);
    return doc;
  }

  @Override
  public Object getEntity() {
    return mcpExecution;
  }

  private void setParentRelationships(Map<String, Object> doc) {
    if (mcpExecution.getServer() == null) {
      return;
    }

    McpServer server =
        Entity.getEntityOrNull(mcpExecution.getServer(), "owners,domain,tags", Include.ALL);
    if (server == null) {
      return;
    }

    McpServer serverDoc =
        new McpServer()
            .withId(server.getId())
            .withName(server.getName())
            .withFullyQualifiedName(server.getFullyQualifiedName())
            .withDisplayName(server.getDisplayName())
            .withDescription(server.getDescription())
            .withDeleted(server.getDeleted())
            .withOwners(server.getOwners())
            .withDomain(server.getDomain())
            .withTags(server.getTags())
            .withServerType(server.getServerType())
            .withTransportType(server.getTransportType());
    doc.put("server", serverDoc);

    if (server.getDomain() != null) {
      doc.put("domain", server.getDomain());
    }
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put("server.name", 10.0f);
    fields.put("server.displayName", 15.0f);
    fields.put("server.fullyQualifiedName", 10.0f);
    fields.put("status", 5.0f);
    fields.put("executedBy", 5.0f);
    return fields;
  }
}
