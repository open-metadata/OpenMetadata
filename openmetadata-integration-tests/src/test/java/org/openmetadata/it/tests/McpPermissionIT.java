/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.entity.ai.McpExecution;
import org.openmetadata.schema.entity.ai.McpExecutionStatus;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.McpTransportType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Permission tests for MCP Server and MCP Execution APIs. Tests that different users with different
 * roles have appropriate access to MCP entities.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class McpPermissionIT {
  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  public static class McpServerList extends org.openmetadata.schema.utils.ResultList<McpServer> {}

  public static class McpExecutionList
      extends org.openmetadata.schema.utils.ResultList<McpExecution> {}

  // ==================== MCP Server Permission Tests ====================

  @Test
  void testAdminCanCreateMcpServer(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("admin-create-server"))
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Admin created MCP server");

    McpServer server = createMcpServer(SdkClients.adminClient(), create);
    assertNotNull(server);
    assertEquals(create.getName(), server.getName());
  }

  @Test
  void testUser1WithRoleCanCreateMcpServer(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("user1-create-server"))
            .withServerType(McpServerType.WebAPI)
            .withTransportType(McpTransportType.SSE)
            .withDescription("User1 with AllowAll role created MCP server");

    McpServer server = createMcpServer(SdkClients.user1Client(), create);
    assertNotNull(server);
    assertEquals(create.getName(), server.getName());
  }

  @Test
  void testUser2WithoutRoleCannotCreateMcpServer(TestNamespace ns) {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("user2-denied-server"))
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("User2 without roles should not create");

    assertThrows(
        Exception.class,
        () -> createMcpServer(SdkClients.user2Client(), create),
        "User without Create permission should not be able to create MCP server");
  }

  @Test
  void testAllUsersCanReadMcpServer(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("readable-server"))
            .withServerType(McpServerType.FileSystem)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Server readable by all users");

    McpServer created = createMcpServer(SdkClients.adminClient(), create);

    McpServer adminRead = getMcpServer(SdkClients.adminClient(), created.getId());
    assertNotNull(adminRead);
    assertEquals(created.getId(), adminRead.getId());

    McpServer user1Read = getMcpServer(SdkClients.user1Client(), created.getId());
    assertNotNull(user1Read);
    assertEquals(created.getId(), user1Read.getId());

    McpServer user2Read = getMcpServer(SdkClients.user2Client(), created.getId());
    assertNotNull(user2Read);
    assertEquals(created.getId(), user2Read.getId());
  }

  @Test
  void testAllUsersCanListMcpServers(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("listable-server"))
            .withServerType(McpServerType.Cloud)
            .withTransportType(McpTransportType.SSE)
            .withDescription("Server for list test");

    createMcpServer(SdkClients.adminClient(), create);

    McpServerList adminList = listMcpServers(SdkClients.adminClient(), 100);
    assertNotNull(adminList);
    assertTrue(adminList.getData().size() > 0, "Admin should see servers in list");

    McpServerList user1List = listMcpServers(SdkClients.user1Client(), 100);
    assertNotNull(user1List);

    McpServerList user2List = listMcpServers(SdkClients.user2Client(), 100);
    assertNotNull(user2List);
  }

  @Test
  void testUser2WithoutRoleCannotDeleteMcpServer(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("protected-delete-server"))
            .withServerType(McpServerType.Security)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Server that user2 cannot delete");

    McpServer created = createMcpServer(SdkClients.adminClient(), create);

    assertThrows(
        Exception.class,
        () -> deleteMcpServer(SdkClients.user2Client(), created.getId(), false),
        "User without Delete permission should not be able to delete MCP server");
  }

  @Test
  void testAdminCanDeleteMcpServer(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("deletable-server"))
            .withServerType(McpServerType.Custom)
            .withTransportType(McpTransportType.Streamable)
            .withDescription("Server that admin can delete");

    McpServer created = createMcpServer(SdkClients.adminClient(), create);
    deleteMcpServer(SdkClients.adminClient(), created.getId(), false);

    McpServer deleted =
        getMcpServerWithInclude(SdkClients.adminClient(), created.getId(), "deleted");
    assertTrue(deleted.getDeleted(), "Server should be soft deleted");
  }

  @Test
  void testUser1WithRoleCanDeleteOwnMcpServer(TestNamespace ns) throws Exception {
    SharedEntities shared = SharedEntities.get();

    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("user1-owned-server"))
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Stdio)
            .withOwners(List.of(shared.USER1_REF))
            .withDescription("Server owned by user1");

    McpServer created = createMcpServer(SdkClients.adminClient(), create);
    deleteMcpServer(SdkClients.user1Client(), created.getId(), false);

    McpServer deleted =
        getMcpServerWithInclude(SdkClients.adminClient(), created.getId(), "deleted");
    assertTrue(deleted.getDeleted(), "User1 should be able to delete their own server");
  }

  @Test
  void testUser1WithRoleCanUpdateMcpServer(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("updatable-server"))
            .withServerType(McpServerType.WebAPI)
            .withTransportType(McpTransportType.SSE)
            .withDescription("Original description");

    McpServer created = createMcpServer(SdkClients.adminClient(), create);

    String patchJson =
        "[{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"Updated by user1\"}]";

    patchMcpServer(SdkClients.user1Client(), created.getId(), patchJson);

    McpServer updated = getMcpServer(SdkClients.adminClient(), created.getId());
    assertEquals("Updated by user1", updated.getDescription());
  }

  // ==================== DataConsumer Policy Tests ====================
  // The Organization team has DataConsumer as default role, which grants:
  // ViewAll, EditDescription, EditTags, EditGlossaryTerms, EditTier, EditCertification
  // User2 (no explicit roles) inherits DataConsumer from Organization

  @Test
  void testUser2WithDataConsumerCanEditDescription(TestNamespace ns) throws Exception {
    // User2 inherits DataConsumer role from Organization, which allows EditDescription
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("dataconsumer-edit-desc"))
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Original description");

    McpServer created = createMcpServer(SdkClients.adminClient(), create);

    String patchJson =
        "[{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"Updated by user2 via DataConsumer\"}]";

    patchMcpServer(SdkClients.user2Client(), created.getId(), patchJson);

    McpServer updated = getMcpServer(SdkClients.adminClient(), created.getId());
    assertEquals("Updated by user2 via DataConsumer", updated.getDescription());
  }

  @Test
  void testUser2WithDataConsumerCanEditTags(TestNamespace ns) throws Exception {
    // User2 inherits DataConsumer role from Organization, which allows EditTags
    SharedEntities shared = SharedEntities.get();

    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("dataconsumer-edit-tags"))
            .withServerType(McpServerType.WebAPI)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Server for tag editing test");

    McpServer created = createMcpServer(SdkClients.adminClient(), create);

    String patchJson =
        String.format(
            "[{\"op\": \"add\", \"path\": \"/tags\", \"value\": [{\"tagFQN\": \"%s\", \"source\": \"Classification\"}]}]",
            shared.PERSONAL_DATA_TAG.getFullyQualifiedName());

    patchMcpServer(SdkClients.user2Client(), created.getId(), patchJson);

    McpServer updated = getMcpServerWithFields(SdkClients.adminClient(), created.getId(), "tags");
    assertNotNull(updated.getTags(), "Tags field should be returned");
    assertTrue(updated.getTags().size() > 0, "Tags should be added by DataConsumer user");
  }

  @Test
  void testUser2WithDataConsumerCannotEditDisplayName(TestNamespace ns) throws Exception {
    // EditDisplayName is NOT in DataConsumer policy - should fail
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("no-displayname-edit"))
            .withServerType(McpServerType.FileSystem)
            .withTransportType(McpTransportType.SSE)
            .withDisplayName("Original Display Name");

    McpServer created = createMcpServer(SdkClients.adminClient(), create);

    String patchJson =
        "[{\"op\": \"replace\", \"path\": \"/displayName\", \"value\": \"Unauthorized Name\"}]";

    assertThrows(
        Exception.class,
        () -> patchMcpServer(SdkClients.user2Client(), created.getId(), patchJson),
        "DataConsumer should not be able to edit displayName (not in policy)");
  }

  @Test
  void testUser2CanSetOwnerOnUnownedEntity(TestNamespace ns) throws Exception {
    // OrganizationPolicy allows EditOwners when noOwner() is true
    SharedEntities shared = SharedEntities.get();

    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("unowned-server"))
            .withServerType(McpServerType.Security)
            .withTransportType(McpTransportType.Streamable)
            .withDescription("Server with no owner - anyone can set owner");
    // Note: No owners set

    McpServer created = createMcpServer(SdkClients.adminClient(), create);

    String patchJson =
        String.format(
            "[{\"op\": \"add\", \"path\": \"/owners\", \"value\": [{\"id\": \"%s\", \"type\": \"user\"}]}]",
            shared.USER2.getId());

    // Should succeed because noOwner() is true
    patchMcpServer(SdkClients.user2Client(), created.getId(), patchJson);

    McpServer updated = getMcpServerWithFields(SdkClients.adminClient(), created.getId(), "owners");
    assertNotNull(updated.getOwners(), "Owners field should be returned");
    assertTrue(updated.getOwners().size() > 0, "Owner should be set on unowned entity");
  }

  @Test
  void testUser2CannotChangeOwnerOnOwnedEntity(TestNamespace ns) throws Exception {
    // OrganizationPolicy only allows EditOwners when noOwner() - owned entities are protected
    SharedEntities shared = SharedEntities.get();

    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("owned-server"))
            .withServerType(McpServerType.Cloud)
            .withTransportType(McpTransportType.Stdio)
            .withOwners(List.of(shared.USER1_REF)) // Has an owner
            .withDescription("Server with owner - protected from unauthorized changes");

    McpServer created = createMcpServer(SdkClients.adminClient(), create);

    String patchJson =
        String.format(
            "[{\"op\": \"replace\", \"path\": \"/owners\", \"value\": [{\"id\": \"%s\", \"type\": \"user\"}]}]",
            shared.USER2.getId());

    // Should fail because noOwner() is false (entity has owner) and user2 is not the owner
    assertThrows(
        Exception.class,
        () -> patchMcpServer(SdkClients.user2Client(), created.getId(), patchJson),
        "Non-owner should not be able to change owners on owned entity");
  }

  // ==================== MCP Execution Permission Tests ====================

  @Test
  void testAdminCanCreateMcpExecution(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(SdkClients.adminClient(), ns, "admin-exec-server");

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    McpExecution created = createMcpExecution(SdkClients.adminClient(), execution);
    assertNotNull(created);
    assertEquals(server.getId(), created.getServerId());
  }

  @Test
  void testUser1WithRoleCanCreateMcpExecution(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(SdkClients.adminClient(), ns, "user1-exec-server");

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    McpExecution created = createMcpExecution(SdkClients.user1Client(), execution);
    assertNotNull(created);
  }

  @Test
  void testUser2WithoutRoleCannotCreateMcpExecution(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(SdkClients.adminClient(), ns, "user2-exec-denied");

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    assertThrows(
        Exception.class,
        () -> createMcpExecution(SdkClients.user2Client(), execution),
        "User without Create permission should not be able to create MCP execution");
  }

  @Test
  void testAllUsersCanReadMcpExecution(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(SdkClients.adminClient(), ns, "readable-exec-server");

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    McpExecution created = createMcpExecution(SdkClients.adminClient(), execution);

    McpExecution adminRead = getMcpExecution(SdkClients.adminClient(), created.getId());
    assertNotNull(adminRead);

    McpExecution user1Read = getMcpExecution(SdkClients.user1Client(), created.getId());
    assertNotNull(user1Read);

    McpExecution user2Read = getMcpExecution(SdkClients.user2Client(), created.getId());
    assertNotNull(user2Read);
  }

  @Test
  void testAllUsersCanListMcpExecutions(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(SdkClients.adminClient(), ns, "listable-exec-server");

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    createMcpExecution(SdkClients.adminClient(), execution);

    McpExecutionList adminList = listMcpExecutions(SdkClients.adminClient(), 100);
    assertNotNull(adminList);

    McpExecutionList user1List = listMcpExecutions(SdkClients.user1Client(), 100);
    assertNotNull(user1List);

    McpExecutionList user2List = listMcpExecutions(SdkClients.user2Client(), 100);
    assertNotNull(user2List);
  }

  @Test
  void testUser2WithoutRoleCannotDeleteMcpExecution(TestNamespace ns) throws Exception {
    McpServer server =
        createTestMcpServer(SdkClients.adminClient(), ns, "protected-del-exec-server");

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    McpExecution created = createMcpExecution(SdkClients.adminClient(), execution);

    assertThrows(
        Exception.class,
        () -> deleteMcpExecution(SdkClients.user2Client(), created.getId(), false),
        "User without Delete permission should not be able to delete MCP execution");
  }

  @Test
  void testAdminCanDeleteMcpExecution(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(SdkClients.adminClient(), ns, "deletable-exec-server");

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    McpExecution created = createMcpExecution(SdkClients.adminClient(), execution);
    deleteMcpExecution(SdkClients.adminClient(), created.getId(), true);
  }

  // ==================== Helper Methods ====================

  private McpServer createTestMcpServer(OpenMetadataClient client, TestNamespace ns, String name)
      throws Exception {
    String uniqueName = ns.prefix(name) + "-" + UUID.randomUUID().toString().substring(0, 8);
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(uniqueName)
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Test server for permission tests");
    return createMcpServer(client, create);
  }

  private McpServer createMcpServer(OpenMetadataClient client, CreateMcpServer create)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/mcpServers", create, RequestOptions.builder().build());
    return MAPPER.readValue(response, McpServer.class);
  }

  private McpServer getMcpServer(OpenMetadataClient client, UUID id) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/mcpServers/" + id.toString(),
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, McpServer.class);
  }

  private McpServer getMcpServerWithInclude(OpenMetadataClient client, UUID id, String include)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/mcpServers/" + id.toString() + "?include=" + include,
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, McpServer.class);
  }

  private McpServer getMcpServerWithFields(OpenMetadataClient client, UUID id, String fields)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/mcpServers/" + id.toString() + "?fields=" + fields,
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, McpServer.class);
  }

  private McpServerList listMcpServers(OpenMetadataClient client, int limit) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/mcpServers?limit=" + limit,
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, McpServerList.class);
  }

  private void deleteMcpServer(OpenMetadataClient client, UUID id, boolean hardDelete)
      throws Exception {
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/mcpServers/" + id.toString() + "?hardDelete=" + hardDelete,
            null,
            RequestOptions.builder().build());
  }

  private void patchMcpServer(OpenMetadataClient client, UUID id, String patchJson)
      throws Exception {
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/mcpServers/" + id.toString(),
            patchJson,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }

  private McpExecution createMcpExecution(OpenMetadataClient client, McpExecution execution)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/mcpExecutions", execution, RequestOptions.builder().build());
    return MAPPER.readValue(response, McpExecution.class);
  }

  private McpExecution getMcpExecution(OpenMetadataClient client, UUID id) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/mcpExecutions/" + id.toString(),
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, McpExecution.class);
  }

  private McpExecutionList listMcpExecutions(OpenMetadataClient client, int limit)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/mcpExecutions?limit=" + limit,
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, McpExecutionList.class);
  }

  private void deleteMcpExecution(OpenMetadataClient client, UUID id, boolean hardDelete)
      throws Exception {
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/mcpExecutions/" + id.toString() + "?hardDelete=" + hardDelete,
            null,
            RequestOptions.builder().build());
  }
}
