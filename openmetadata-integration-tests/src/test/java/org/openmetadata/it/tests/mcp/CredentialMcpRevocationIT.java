/*
 *  Copyright 2026 Collate
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

package org.openmetadata.it.tests.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.spec.McpSchema;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.tests.CredentialFixtures;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.mcp.AuthEnrichedMcpContextExtractor;
import org.openmetadata.mcp.McpServer;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport;

/**
 * A revoked personal access token is refused on the MCP endpoint at both layers: the transport
 * answers 401, and the tool callback checks the token itself.
 */
@ExtendWith(TestNamespaceExtension.class)
class CredentialMcpRevocationIT extends McpTestBase {
  private static final String TOOL = "search_metadata";
  private static final Duration MARGIN = Duration.ofSeconds(3);

  @Test
  void revokedPatIsRejectedByTheMcpTransport(TestNamespace ns) throws Exception {
    User owner = createOwner(ns, "mcptransport");
    PersonalAccessToken pat = createPat(owner, ns);
    assertEquals(200, mcpStatus(pat.getJwtToken()), "the live PAT is accepted");

    revoke(owner, pat);

    Awaitility.await("MCP transport answers 401 for the revoked PAT")
        .atMost(bound().toMillis(), TimeUnit.MILLISECONDS)
        .pollInterval(100, TimeUnit.MILLISECONDS)
        .untilAsserted(() -> assertEquals(401, mcpStatus(pat.getJwtToken())));
  }

  @Test
  void toolCallbackRejectsARevokedPatWhenCalledDirectly(TestNamespace ns) {
    User owner = createOwner(ns, "mcpcallback");
    PersonalAccessToken pat = createPat(owner, ns);
    DirectMcpServer server = new DirectMcpServer();
    assertTrue(
        owner.getName().equalsIgnoreCase(server.principalOf(pat.getJwtToken())),
        "the live PAT authenticates as its owner");

    revoke(owner, pat);

    Awaitility.await("tool callback refuses the revoked PAT")
        .atMost(bound().toMillis(), TimeUnit.MILLISECONDS)
        .pollInterval(100, TimeUnit.MILLISECONDS)
        .untilAsserted(
            () ->
                assertThrows(
                    AuthenticationException.class, () -> server.callTool(TOOL, pat.getJwtToken())));
  }

  private static Duration bound() {
    return CredentialSourceTestSupport.serverMaxStaleness().plus(MARGIN);
  }

  private static User createOwner(TestNamespace ns, String base) {
    return CredentialFixtures.createUser(ns, base);
  }

  private static PersonalAccessToken createPat(User owner, TestNamespace ns) {
    return CredentialFixtures.createPat(owner, ns.prefix("pat"));
  }

  private static void revoke(User owner, PersonalAccessToken pat) {
    CredentialFixtures.revokePat(owner, pat);
  }

  private static int mcpStatus(String token) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(TestSuiteBootstrap.getBaseUrl() + "/mcp"))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", "Bearer " + token)
            .POST(
                HttpRequest.BodyPublishers.ofString(
                    OBJECT_MAPPER.writeValueAsString(McpTestUtils.createInitializeRequest())))
            .timeout(Duration.ofSeconds(30))
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString()).statusCode();
  }

  /** The production tool callback, reached without the transport's own token check in front. */
  private static final class DirectMcpServer extends McpServer {
    DirectMcpServer() {
      this.jwtFilter =
          new JwtFilter(
              SecurityConfigurationManager.getCurrentAuthConfig(),
              SecurityConfigurationManager.getCurrentAuthzConfig());
    }

    String principalOf(String token) {
      return jwtFilter.getCatalogSecurityContext(token).getUserPrincipal().getName();
    }

    McpSchema.CallToolResult callTool(String toolName, String token) {
      McpSchema.Tool tool =
          getTools().stream().filter(t -> t.name().equals(toolName)).findFirst().orElseThrow();
      McpTransportContext context =
          McpTransportContext.create(
              Map.of(AuthEnrichedMcpContextExtractor.AUTHORIZATION_HEADER, token));
      return getTool(tool)
          .callHandler()
          .apply(context, new McpSchema.CallToolRequest(toolName, Map.of()));
    }
  }
}
