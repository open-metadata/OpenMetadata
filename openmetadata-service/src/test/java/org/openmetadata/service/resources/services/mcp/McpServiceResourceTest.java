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

package org.openmetadata.service.resources.services.mcp;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.services.CreateMcpService;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.services.connections.mcp.McpConnection;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.ServiceResourceTest;
import org.openmetadata.service.resources.services.mcp.McpServiceResource.McpServiceList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class McpServiceResourceTest extends ServiceResourceTest<McpService, CreateMcpService> {
  public McpServiceResourceTest() {
    super(
        Entity.MCP_SERVICE,
        McpService.class,
        McpServiceList.class,
        "services/mcpServices",
        McpServiceResource.FIELDS);
    this.supportsPatch = false;
    supportsSearchIndex = true;
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param serviceType must not be null]");
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException {
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);

    McpConnection mcpConnection =
        new McpConnection()
            .withType(McpConnection.McpType.MCP)
            .withDiscoveryMethod(McpConnection.DiscoveryMethod.DirectConnection)
            .withServers(
                List.of(
                    new McpServerConfig()
                        .withName("custom-server")
                        .withTransport(McpServerConfig.TransportType.SSE)
                        .withUrl("http://localhost:8080")));
    createAndCheckEntity(
        createRequest(test, 3)
            .withConnection(
                new org.openmetadata.schema.type.McpConnection().withConfig(mcpConnection)),
        authHeaders);

    createAndCheckEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updateService_as_admin_2xx(TestInfo test) throws IOException {
    org.openmetadata.schema.type.McpConnection mcpConnection =
        new org.openmetadata.schema.type.McpConnection()
            .withConfig(
                new McpConnection()
                    .withType(McpConnection.McpType.MCP)
                    .withDiscoveryMethod(McpConnection.DiscoveryMethod.DirectConnection)
                    .withServers(
                        List.of(
                            new McpServerConfig()
                                .withName("server-1")
                                .withTransport(McpServerConfig.TransportType.Stdio)
                                .withCommand("echo"))));
    McpService service =
        createAndCheckEntity(
            createRequest(test).withDescription(null).withConnection(mcpConnection),
            ADMIN_AUTH_HEADERS);

    org.openmetadata.schema.type.McpConnection mcpConnection1 =
        new org.openmetadata.schema.type.McpConnection()
            .withConfig(
                new McpConnection()
                    .withType(McpConnection.McpType.MCP)
                    .withDiscoveryMethod(McpConnection.DiscoveryMethod.DirectConnection)
                    .withServers(
                        List.of(
                            new McpServerConfig()
                                .withName("server-2")
                                .withTransport(McpServerConfig.TransportType.SSE)
                                .withUrl("http://localhost:9090"))));

    CreateMcpService update =
        createRequest(test)
            .withDescription("description1")
            .withConnection(mcpConnection1)
            .withName(service.getName());

    ChangeDescription change = getChangeDescription(service, MINOR_UPDATE);
    fieldAdded(change, "description", "description1");
    fieldUpdated(change, "connection", mcpConnection, mcpConnection1);
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_testConnectionResult_200(TestInfo test) throws IOException {
    McpService service = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    assertNull(service.getTestConnectionResult());
    McpService updatedService =
        putTestConnectionResult(service.getId(), TEST_CONNECTION_RESULT, ADMIN_AUTH_HEADERS);
    assertNotNull(updatedService.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL,
        updatedService.getTestConnectionResult().getStatus());
    assertEquals(updatedService.getConnection(), service.getConnection());
    McpService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(stored.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, stored.getTestConnectionResult().getStatus());
    assertEquals(stored.getConnection(), service.getConnection());
  }

  public McpService putTestConnectionResult(
      UUID serviceId, TestConnectionResult testConnectionResult, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(serviceId).path("/testConnectionResult");
    return TestUtils.put(target, testConnectionResult, McpService.class, OK, authHeaders);
  }

  @Override
  public CreateMcpService createRequest(String name) {
    return new CreateMcpService()
        .withName(name)
        .withServiceType(CreateMcpService.McpServiceType.Mcp)
        .withConnection(
            new org.openmetadata.schema.type.McpConnection()
                .withConfig(
                    new McpConnection()
                        .withType(McpConnection.McpType.MCP)
                        .withDiscoveryMethod(McpConnection.DiscoveryMethod.DirectConnection)
                        .withServers(
                            List.of(
                                new McpServerConfig()
                                    .withName("test-server")
                                    .withTransport(McpServerConfig.TransportType.Stdio)
                                    .withCommand("echo")
                                    .withArgs(List.of("test"))))));
  }

  @Override
  public void validateCreatedEntity(
      McpService service, CreateMcpService createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), service.getName());
    org.openmetadata.schema.type.McpConnection expectedConnection = createRequest.getConnection();
    org.openmetadata.schema.type.McpConnection actualConnection = service.getConnection();
    validateConnection(expectedConnection, actualConnection, service.getServiceType());
  }

  @Override
  public void compareEntities(
      McpService expected, McpService updated, Map<String, String> authHeaders) {}

  @Override
  public McpService validateGetWithDifferentFields(McpService service, boolean byName)
      throws HttpResponseException {
    String fields = "";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(service.getOwners());

    fields = "owners,tags,followers";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    return service;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("connection")) {
      assertTrue(
          ((String) actual).contains("-encrypted-value") || actual.toString().contains("servers"));
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateConnection(
      org.openmetadata.schema.type.McpConnection expectedConnection,
      org.openmetadata.schema.type.McpConnection actualConnection,
      CreateMcpService.McpServiceType mcpServiceType) {
    if (expectedConnection != null && actualConnection != null) {
      if (mcpServiceType == CreateMcpService.McpServiceType.Mcp) {
        McpConnection expectedMcp = (McpConnection) expectedConnection.getConfig();
        McpConnection actualMcp;
        if (actualConnection.getConfig() instanceof McpConnection) {
          actualMcp = (McpConnection) actualConnection.getConfig();
        } else {
          actualMcp = JsonUtils.convertValue(actualConnection.getConfig(), McpConnection.class);
        }
        assertEquals(expectedMcp.getDiscoveryMethod(), actualMcp.getDiscoveryMethod());
      }
    }
  }
}
