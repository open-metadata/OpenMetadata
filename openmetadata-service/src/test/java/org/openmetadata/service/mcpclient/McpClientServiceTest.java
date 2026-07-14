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

package org.openmetadata.service.mcpclient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.ActivePersonaContext;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class McpClientServiceTest {

  @AfterEach
  void clearRequestContext() {
    ImpersonationContext.clear();
    ActivePersonaContext.clear();
  }

  @Test
  void preservesCatalogSecurityContext() {
    CatalogSecurityContext securityContext =
        new CatalogSecurityContext(
            () -> "alice", "https", SecurityContext.DIGEST_AUTH, Set.of(), false, null, null);

    assertSame(securityContext, McpClientService.toCatalogSecurityContext(securityContext));
  }

  @Test
  void wrappedSecurityContextPreservesRequestHints() {
    Principal principal = () -> "alice";
    SecurityContext wrappedSecurityContext = mock(SecurityContext.class);
    when(wrappedSecurityContext.getUserPrincipal()).thenReturn(principal);
    when(wrappedSecurityContext.isSecure()).thenReturn(true);
    when(wrappedSecurityContext.getAuthenticationScheme()).thenReturn(SecurityContext.DIGEST_AUTH);
    ImpersonationContext.setImpersonatedBy("ingestion-bot");
    ActivePersonaContext.setActivePersona("data-steward");

    CatalogSecurityContext catalogSecurityContext =
        McpClientService.toCatalogSecurityContext(wrappedSecurityContext);

    assertSame(principal, catalogSecurityContext.getUserPrincipal());
    assertEquals(SecurityContext.DIGEST_AUTH, catalogSecurityContext.getAuthenticationScheme());
    assertEquals("ingestion-bot", catalogSecurityContext.impersonatedUser());
    assertEquals("data-steward", catalogSecurityContext.activePersona());
    assertFalse(catalogSecurityContext.isBot());
    assertEquals(Set.of(), catalogSecurityContext.getUserRoles());
  }
}
