package org.openmetadata.sdk.fluent;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.entity.ai.McpDevelopmentStage;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpPrompt;
import org.openmetadata.schema.entity.ai.McpResource;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerCapabilities;
import org.openmetadata.schema.entity.ai.McpServerInfo;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.McpTool;
import org.openmetadata.schema.entity.ai.McpTransportType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;

/**
 * Fluent API for MCP Server operations.
 *
 * <p>Usage:
 *
 * <pre>
 * // Create
 * McpServer server = McpServers.create()
 *     .name("my-mcp-server")
 *     .withServerType(McpServerType.DataAccess)
 *     .withTransportType(McpTransportType.Stdio)
 *     .withDescription("MCP Server for data access")
 *     .execute();
 *
 * // Find
 * McpServer server = McpServers.find(serverId).fetch();
 *
 * // List
 * McpServers.list().limit(10).forEach(server -> process(server));
 * </pre>
 */
public final class McpServers {
  private static OpenMetadataClient defaultClient;

  private McpServers() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call McpServers.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static McpServerCreator create() {
    return new McpServerCreator(getClient());
  }

  public static McpServer create(CreateMcpServer request) {
    return getClient().mcpServers().create(request);
  }

  // ==================== Direct Access ====================

  public static McpServer get(String id) {
    return getClient().mcpServers().get(id);
  }

  public static McpServer get(String id, String fields) {
    return getClient().mcpServers().get(id, fields);
  }

  public static McpServer getByName(String fqn) {
    return getClient().mcpServers().getByName(fqn);
  }

  public static McpServer getByName(String fqn, String fields) {
    return getClient().mcpServers().getByName(fqn, fields);
  }

  public static McpServer update(String id, McpServer entity) {
    return getClient().mcpServers().update(id, entity);
  }

  public static void delete(String id) {
    getClient().mcpServers().delete(id);
  }

  public static void delete(String id, Map<String, String> params) {
    getClient().mcpServers().delete(id, params);
  }

  public static void restore(String id) {
    getClient().mcpServers().restore(id);
  }

  // ==================== Finders ====================

  public static McpServerFinder find(String id) {
    return new McpServerFinder(getClient(), id);
  }

  public static McpServerFinder find(UUID id) {
    return find(id.toString());
  }

  public static McpServerFinder findByName(String fqn) {
    return new McpServerFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static McpServerLister list() {
    return new McpServerLister(getClient());
  }

  // ==================== Creator ====================

  public static class McpServerCreator {
    private final OpenMetadataClient client;
    private final CreateMcpServer request = new CreateMcpServer();

    McpServerCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public McpServerCreator name(String name) {
      request.setName(name);
      return this;
    }

    public McpServerCreator withServerType(McpServerType serverType) {
      request.setServerType(serverType);
      return this;
    }

    public McpServerCreator withTransportType(McpTransportType transportType) {
      request.setTransportType(transportType);
      return this;
    }

    public McpServerCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public McpServerCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public McpServerCreator withProtocolVersion(String protocolVersion) {
      request.setProtocolVersion(protocolVersion);
      return this;
    }

    public McpServerCreator withDevelopmentStage(McpDevelopmentStage developmentStage) {
      request.setDevelopmentStage(developmentStage);
      return this;
    }

    public McpServerCreator withServerInfo(McpServerInfo serverInfo) {
      request.setServerInfo(serverInfo);
      return this;
    }

    public McpServerCreator withCapabilities(McpServerCapabilities capabilities) {
      request.setCapabilities(capabilities);
      return this;
    }

    public McpServerCreator withTools(List<McpTool> tools) {
      request.setTools(tools);
      return this;
    }

    public McpServerCreator withResources(List<McpResource> resources) {
      request.setResources(resources);
      return this;
    }

    public McpServerCreator withPrompts(List<McpPrompt> prompts) {
      request.setPrompts(prompts);
      return this;
    }

    public McpServerCreator withGovernanceMetadata(McpGovernanceMetadata governanceMetadata) {
      request.setGovernanceMetadata(governanceMetadata);
      return this;
    }

    public McpServerCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public McpServer execute() {
      return client.mcpServers().create(request);
    }

    public McpServer now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class McpServerFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    McpServerFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    McpServerFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public McpServerFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public McpServerFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public McpServerFinder includeTools() {
      includes.add("tools");
      return this;
    }

    public McpServerFinder includeResources() {
      includes.add("resources");
      return this;
    }

    public McpServerFinder includePrompts() {
      includes.add("prompts");
      return this;
    }

    public McpServerFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public McpServerFinder includeAll() {
      includes.addAll(
          Arrays.asList("owners", "tags", "followers", "domain", "tools", "resources", "prompts"));
      return this;
    }

    public FluentMcpServer fetch() {
      McpServer entity;
      if (includes.isEmpty()) {
        entity =
            isFqn ? client.mcpServers().getByName(identifier) : client.mcpServers().get(identifier);
      } else {
        String fields = String.join(",", includes);
        entity =
            isFqn
                ? client.mcpServers().getByName(identifier, fields)
                : client.mcpServers().get(identifier, fields);
      }
      return new FluentMcpServer(entity, client);
    }

    public McpServer get() {
      return fetch().get();
    }

    public McpServerDeleter delete() {
      return new McpServerDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class McpServerDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    McpServerDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public McpServerDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public McpServerDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.mcpServers().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class McpServerLister {
    private final OpenMetadataClient client;
    private Integer limit;
    private String after;
    private final Map<String, String> filters = new HashMap<>();

    McpServerLister(OpenMetadataClient client) {
      this.client = client;
    }

    public McpServerLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public McpServerLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public McpServerLister filter(String key, String value) {
      filters.put(key, value);
      return this;
    }

    public McpServerLister byServerType(McpServerType serverType) {
      filters.put("serverType", serverType.value());
      return this;
    }

    public McpServerLister byTransportType(McpTransportType transportType) {
      filters.put("transportType", transportType.value());
      return this;
    }

    public List<FluentMcpServer> fetch() {
      var params = new ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.mcpServers().list(params);
      List<FluentMcpServer> items = new ArrayList<>();
      for (McpServer item : response.getData()) {
        items.add(new FluentMcpServer(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentMcpServer> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentMcpServer {
    private final McpServer entity;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentMcpServer(McpServer entity, OpenMetadataClient client) {
      this.entity = entity;
      this.client = client;
    }

    public McpServer get() {
      return entity;
    }

    public FluentMcpServer withDescription(String description) {
      entity.setDescription(description);
      modified = true;
      return this;
    }

    public FluentMcpServer withDisplayName(String displayName) {
      entity.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentMcpServer withOwners(List<EntityReference> owners) {
      entity.setOwners(owners);
      modified = true;
      return this;
    }

    public FluentMcpServer withServerInfo(McpServerInfo serverInfo) {
      entity.setServerInfo(serverInfo);
      modified = true;
      return this;
    }

    public FluentMcpServer withCapabilities(McpServerCapabilities capabilities) {
      entity.setCapabilities(capabilities);
      modified = true;
      return this;
    }

    public FluentMcpServer withTools(List<McpTool> tools) {
      entity.setTools(tools);
      modified = true;
      return this;
    }

    public FluentMcpServer withResources(List<McpResource> resources) {
      entity.setResources(resources);
      modified = true;
      return this;
    }

    public FluentMcpServer withPrompts(List<McpPrompt> prompts) {
      entity.setPrompts(prompts);
      modified = true;
      return this;
    }

    public FluentMcpServer withGovernanceMetadata(McpGovernanceMetadata governanceMetadata) {
      entity.setGovernanceMetadata(governanceMetadata);
      modified = true;
      return this;
    }

    public FluentMcpServer withDevelopmentStage(McpDevelopmentStage developmentStage) {
      entity.setDevelopmentStage(developmentStage);
      modified = true;
      return this;
    }

    public FluentMcpServer save() {
      if (modified) {
        McpServer updated = client.mcpServers().update(entity.getId().toString(), entity);
        entity.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public McpServerDeleter delete() {
      return new McpServerDeleter(client, entity.getId().toString());
    }
  }
}
