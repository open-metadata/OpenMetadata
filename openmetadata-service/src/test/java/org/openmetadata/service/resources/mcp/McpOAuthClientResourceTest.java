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

package org.openmetadata.service.resources.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.mcp.OAuthClient;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.OAuthDAOs;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;

class McpOAuthClientResourceTest {
  @Test
  void adminInventoryContainsNoCredentials() {
    Authorizer authorizer = mock(Authorizer.class);
    OAuthDAOs.OAuthClientDAO dao = mock(OAuthDAOs.OAuthClientDAO.class);
    when(dao.listClients("", 100))
        .thenReturn(List.of(new OAuthClient().withClientId("client").withIssuedAt(1L)));
    var result =
        new McpOAuthClientResource(authorizer, dao).list(mock(SecurityContext.class), "", 100);
    assertThat(result).extracting(OAuthClient::getClientId).containsExactly("client");
    assertThat(JsonUtils.pojoToJson(result)).doesNotContain("secret", "token");
  }

  @Test
  void unauthorizedCallerCannotListOrDelete() {
    Authorizer authorizer = mock(Authorizer.class);
    OAuthDAOs.OAuthClientDAO dao = mock(OAuthDAOs.OAuthClientDAO.class);
    SecurityContext context = mock(SecurityContext.class);
    doThrow(new AuthorizationException("forbidden")).when(authorizer).authorizeAdmin(context);
    McpOAuthClientResource resource = new McpOAuthClientResource(authorizer, dao);
    assertThatThrownBy(() -> resource.list(context, "", 100))
        .isInstanceOf(AuthorizationException.class);
    assertThatThrownBy(() -> resource.delete(context, "client"))
        .isInstanceOf(AuthorizationException.class);
    verifyNoInteractions(dao);
  }

  @Test
  void validatesPagingAndReportsMissingClient() {
    var resource =
        new McpOAuthClientResource(mock(Authorizer.class), mock(OAuthDAOs.OAuthClientDAO.class));
    SecurityContext context = mock(SecurityContext.class);
    for (int limit : List.of(0, 1001)) {
      assertThatThrownBy(() -> resource.list(context, "", limit))
          .isInstanceOf(BadRequestException.class);
    }
    assertThatThrownBy(() -> resource.delete(context, "missing"))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void deletingRegisteredClientReturnsNoContent() {
    OAuthDAOs.OAuthClientDAO dao = mock(OAuthDAOs.OAuthClientDAO.class);
    when(dao.deleteWithGrants("client")).thenReturn(1);
    SecurityContext context = mock(SecurityContext.class);
    when(context.getUserPrincipal()).thenReturn(() -> "admin");
    var resource = new McpOAuthClientResource(mock(Authorizer.class), dao);
    assertThat(resource.delete(context, "client").getStatus()).isEqualTo(204);
  }
}
