package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.api.services.CreateMcpService;
import org.openmetadata.schema.api.services.CreateMcpService.McpServiceType;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.services.connections.mcp.McpConnection.DiscoveryMethod;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig.TransportType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.McpConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

@Execution(ExecutionMode.CONCURRENT)
public class McpServiceResourceIT extends BaseServiceIT<McpService, CreateMcpService> {

  private static final String REGISTRY_URL = "http://localhost:8080";
  private static final String SERVER_API_KEY = "mcp-test-api-key";

  {
    supportsListHistoryByTimestamp = true;
  }

  // The service wrapper and its config are both generated as McpConnection, so the config stays
  // qualified.
  private static McpConnection registryConnection() {
    return new McpConnection()
        .withConfig(
            new org.openmetadata.schema.services.connections.mcp.McpConnection()
                .withDiscoveryMethod(DiscoveryMethod.Registry)
                .withRegistryUrl(REGISTRY_URL));
  }

  private static McpConnection directConnection(String apiKey) {
    McpServerConfig server =
        new McpServerConfig()
            .withName("mcp-server")
            .withTransport(TransportType.StreamableHTTP)
            .withUrl("http://localhost:9000/mcp")
            .withApiKey(apiKey);
    return new McpConnection()
        .withConfig(
            new org.openmetadata.schema.services.connections.mcp.McpConnection()
                .withDiscoveryMethod(DiscoveryMethod.DirectConnection)
                .withServers(List.of(server)));
  }

  private static org.openmetadata.schema.services.connections.mcp.McpConnection configOf(
      McpService service) {
    return JsonUtils.convertValue(
        service.getConnection().getConfig(),
        org.openmetadata.schema.services.connections.mcp.McpConnection.class);
  }

  @Override
  protected CreateMcpService createMinimalRequest(TestNamespace ns) {
    return createRequest(ns.prefix("mcpservice"), ns).withDescription("Test MCP service");
  }

  @Override
  protected CreateMcpService createRequest(String name, TestNamespace ns) {
    return new CreateMcpService()
        .withName(name)
        .withServiceType(McpServiceType.Mcp)
        .withConnection(registryConnection());
  }

  @Override
  protected DeletableSubtree createDeletableSubtree(TestNamespace ns) {
    McpService service = createEntity(createMinimalRequest(ns));
    String serverId =
        SdkClients.adminClient()
            .mcpServers()
            .create(
                new CreateMcpServer()
                    .withName(ns.prefix("del_child"))
                    .withService(service.getFullyQualifiedName())
                    .withServerType(McpServerType.DataAccess))
            .getId()
            .toString();
    return new DeletableSubtree(
        service.getId().toString(),
        List.of(serverId),
        List.of(new SearchDoc("mcp_server_search_index", serverId)));
  }

  @Override
  protected McpService createEntity(CreateMcpService createRequest) {
    return SdkClients.adminClient().mcpServices().create(createRequest);
  }

  @Override
  protected McpService getEntity(String id) {
    return SdkClients.adminClient().mcpServices().get(id);
  }

  @Override
  protected McpService getEntityByName(String fqn) {
    return SdkClients.adminClient().mcpServices().getByName(fqn);
  }

  @Override
  protected McpService patchEntity(String id, McpService entity) {
    return SdkClients.adminClient().mcpServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().mcpServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().mcpServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .mcpServices()
        .delete(id, Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return Entity.MCP_SERVICE;
  }

  @Override
  protected void validateCreatedEntity(McpService entity, CreateMcpService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<McpService> listEntities(ListParams params) {
    return SdkClients.adminClient().mcpServices().list(params);
  }

  @Override
  protected McpService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().mcpServices().get(id, fields);
  }

  @Override
  protected McpService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().mcpServices().getByName(fqn, fields);
  }

  @Override
  protected McpService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().mcpServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().mcpServices().getVersionList(id);
  }

  @Override
  protected McpService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().mcpServices().getVersion(id.toString(), version);
  }

  @Test
  void post_mcpServiceWithRegistryConnection_200_OK(TestNamespace ns) {
    McpService service = createEntity(createRequest(ns.prefix("registry_mcp_service"), ns));

    var persisted = configOf(getEntity(service.getId().toString()));
    assertEquals(DiscoveryMethod.Registry, persisted.getDiscoveryMethod());
    assertEquals(REGISTRY_URL, persisted.getRegistryUrl());
  }

  @Test
  void mcpServiceApiKey_encryptedAtRest_maskedForAdmin_readableForBot(TestNamespace ns) {
    CreateMcpService request =
        createRequest(ns.prefix("direct_mcp_service"), ns)
            .withConnection(directConnection(SERVER_API_KEY));
    McpService service = createEntity(request);
    String id = service.getId().toString();

    var stored =
        configOf(Entity.getCollectionDAO().mcpServiceDAO().findEntityById(service.getId()));
    var adminView = configOf(getEntity(id));
    var botView = configOf(SdkClients.ingestionBotClient().mcpServices().get(id));
    assertTrue(Fernet.isTokenized(stored.getServers().getFirst().getApiKey()));
    assertEquals(PasswordEntityMasker.PASSWORD_MASK, adminView.getServers().getFirst().getApiKey());
    assertEquals(SERVER_API_KEY, botView.getServers().getFirst().getApiKey());
  }
}
