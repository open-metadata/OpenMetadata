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

package org.openmetadata.service.resources.teams;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class TeamGrantAuthorizerTest {

  private static final EntityReference DATA_STEWARD =
      new EntityReference().withId(UUID.randomUUID()).withType("role");

  @Test
  void aNonAdminCannotAddADefaultRole() {
    SecurityContext caller = caller(null);
    Authorizer authorizer = refusingAdmin(caller);
    Team updated = new Team().withDefaultRoles(List.of(DATA_STEWARD));

    assertThrows(
        AuthorizationException.class,
        () -> TeamGrantAuthorizer.authorize(authorizer, caller, new Team(), updated));
  }

  @Test
  void anImpersonatedAdminCannotAddAPolicy() {
    Team updated =
        new Team()
            .withPolicies(
                List.of(new EntityReference().withId(UUID.randomUUID()).withType("policy")));

    assertThrows(
        AuthorizationException.class,
        () ->
            TeamGrantAuthorizer.authorize(
                mock(Authorizer.class), caller("data-consumer"), new Team(), updated));
  }

  @Test
  void keepingTheRolesATeamAlreadyHasNeedsNoAdmin() {
    SecurityContext caller = caller(null);
    Authorizer authorizer = refusingAdmin(caller);
    Team stored = new Team().withDefaultRoles(List.of(DATA_STEWARD));
    Team updated = new Team().withDefaultRoles(List.of(DATA_STEWARD)).withDescription("renamed");

    assertDoesNotThrow(() -> TeamGrantAuthorizer.authorize(authorizer, caller, stored, updated));
  }

  private static Authorizer refusingAdmin(SecurityContext caller) {
    Authorizer authorizer = mock(Authorizer.class);
    doThrow(new AuthorizationException("not an admin")).when(authorizer).authorizeAdmin(caller);
    return authorizer;
  }

  private static SecurityContext caller(String impersonatedUser) {
    return new CatalogSecurityContext(
        () -> "automation-bot",
        "https",
        CatalogSecurityContext.OPENID_AUTH,
        Set.of(),
        true,
        impersonatedUser,
        null,
        null);
  }
}
