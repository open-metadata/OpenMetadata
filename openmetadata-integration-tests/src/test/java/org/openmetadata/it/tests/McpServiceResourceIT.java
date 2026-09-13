package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateMcpService;
import org.openmetadata.schema.api.services.CreateMcpService.McpServiceType;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

@Execution(ExecutionMode.CONCURRENT)
class McpServiceResourceIT extends BaseServiceIT<McpService, CreateMcpService> {
  private static final String PATH = "/v1/services/mcpServices";
  private static EntityServiceBase<McpService> services;

  @BeforeAll
  static void setupServices() {
    services =
        new EntityServiceBase<>(SdkClients.adminClient().getHttpClient(), PATH) {
          @Override
          protected Class<McpService> getEntityClass() {
            return McpService.class;
          }
        };
  }

  @Test
  void connectionResultInvalidatesBothCachedAliasesWithoutChangingTheVersion(TestNamespace ns) {
    final McpService created = createEntity(createMinimalRequest(ns));
    assertNull(getEntity(created.getId().toString()).getTestConnectionResult());
    assertNull(getEntityByName(created.getFullyQualifiedName()).getTestConnectionResult());
    final var result = new TestConnectionResult().withStatus(TestConnectionResultStatus.SUCCESSFUL);
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            PATH + "/" + created.getId() + "/testConnectionResult",
            result,
            McpService.class);
    final McpService byId = getEntity(created.getId().toString());
    final McpService byName = getEntityByName(created.getFullyQualifiedName());
    assertEquals(TestConnectionResultStatus.SUCCESSFUL, byId.getTestConnectionResult().getStatus());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, byName.getTestConnectionResult().getStatus());
    assertEquals(created.getVersion(), byId.getVersion());
    assertEquals(created.getVersion(), byName.getVersion());
  }

  @Override
  protected CreateMcpService createMinimalRequest(TestNamespace ns) {
    return createRequest(ns.prefix("mcp_service"), ns).withDescription("MCP service fixture");
  }

  @Override
  protected CreateMcpService createRequest(String name, TestNamespace ns) {
    return new CreateMcpService().withName(name).withServiceType(McpServiceType.Mcp);
  }

  @Override
  protected McpService createEntity(CreateMcpService request) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, PATH, request, McpService.class);
  }

  @Override
  protected McpService getEntity(String id) {
    return services.get(id);
  }

  @Override
  protected McpService getEntityByName(String fqn) {
    return services.getByName(fqn);
  }

  @Override
  protected McpService patchEntity(String id, McpService entity) {
    return services.update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    services.delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    services.restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    services.delete(id, Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "mcpService";
  }

  @Override
  protected void validateCreatedEntity(McpService entity, CreateMcpService request) {
    assertEquals(request.getName(), entity.getName());
    assertEquals(request.getServiceType(), entity.getServiceType());
    assertEquals(request.getDescription(), entity.getDescription());
  }

  @Override
  protected ListResponse<McpService> listEntities(ListParams params) {
    return services.list(params);
  }

  @Override
  protected McpService getEntityWithFields(String id, String fields) {
    return services.get(id, fields);
  }

  @Override
  protected McpService getEntityByNameWithFields(String fqn, String fields) {
    return services.getByName(fqn, fields);
  }

  @Override
  protected McpService getEntityIncludeDeleted(String id) {
    return services.get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return services.getVersionList(id);
  }

  @Override
  protected McpService getVersion(UUID id, Double version) {
    return services.getVersion(id.toString(), version);
  }

  @Override
  protected EntityServiceBase<McpService> getEntityService() {
    return services;
  }
}
