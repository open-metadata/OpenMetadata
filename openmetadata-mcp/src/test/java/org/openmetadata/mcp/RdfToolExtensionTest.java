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

package org.openmetadata.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.tools.AgentSparqlToolErrors;
import org.openmetadata.mcp.tools.McpToolParameters;
import org.openmetadata.mcp.tools.RdfBody;
import org.openmetadata.mcp.tools.RdfMcpTool;
import org.openmetadata.mcp.tools.RdfNotEnabledException;
import org.openmetadata.mcp.tools.RdfProjectionDegradedException;
import org.openmetadata.mcp.tools.RdfQueryTimeoutException;
import org.openmetadata.mcp.tools.RdfRetryLaterException;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.agent.AgentSparqlException;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class RdfToolExtensionTest {
  @Test
  void aToolInAnotherPackageGetsTheSharedAuthorizationAndRepositoryGuards() throws Exception {
    Authorizer authorizer = mock(Authorizer.class);
    CatalogSecurityContext caller = mock(CatalogSecurityContext.class);
    RdfRepository repository = mock(RdfRepository.class);
    RdfMcpTool<String> tool = new ExtensionTool(() -> repository);

    assertEquals("disabled", tool.execute(authorizer, caller, Map.of()));
    when(repository.isEnabled()).thenReturn(true);
    assertEquals("enabled", tool.execute(authorizer, caller, Map.of()));

    doThrow(new AuthorizationException("Denied"))
        .when(authorizer)
        .authorize(eq(caller), any(), any());
    assertThrows(AuthorizationException.class, () -> tool.execute(authorizer, caller, Map.of()));
    assertThrows(
        AuthorizationException.class, () -> RdfMcpTool.authorizeSparql(authorizer, caller));
  }

  @Test
  void anotherPackageCanUseTheSameResponseBudgetParametersAndErrors() {
    RdfBody.Bounded bounded = RdfBody.bound("a🌍", 4);
    assertEquals(new RdfBody.Bounded("a", true, 5), bounded);

    McpToolParameters parameters = McpToolParameters.from(Map.of("query", " ", "limit", 10));
    assertTrue(McpToolParameters.isBlank(parameters.optionalString("query")));
    assertNull(parameters.optionalString("missing"));
    assertEquals(10, parameters.integer("limit", 1));

    var timeout = new AgentSparqlException(AgentSparqlErrorCode.EXECUTION_TIMEOUT, "timeout");
    assertInstanceOf(
        RdfQueryTimeoutException.class, AgentSparqlToolErrors.toToolException(timeout));
    assertEquals(timeout, new RdfQueryTimeoutException("timeout", timeout).getCause());
    assertEquals(timeout, new RdfProjectionDegradedException("degraded", timeout).getCause());
    assertEquals(timeout, new RdfRetryLaterException("retry", timeout).getCause());
    assertInstanceOf(IllegalStateException.class, new RdfNotEnabledException());
  }

  private static final class ExtensionTool extends RdfMcpTool<String> {
    private ExtensionTool(Supplier<RdfRepository> repository) {
      super(repository, () -> RdfProjectionState.READY);
    }

    @Override
    protected String executeAuthorized(
        Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
      return repositoryOrNull() == null
          ? "disabled"
          : guardedRead(securityContext, () -> "enabled");
    }
  }
}
