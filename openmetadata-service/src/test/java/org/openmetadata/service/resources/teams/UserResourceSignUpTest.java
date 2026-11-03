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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.security.CatalogPrincipal;

class UserResourceSignUpTest {

  @Test
  void aSignUpWithTheTokensNameAndEmailIsTheCallersOwn() {
    SecurityContext caller = callerWith(new CatalogPrincipal("jane", "Jane@Example.com"));

    assertTrue(UserResource.isOwnSignUp(caller, user("jane", "jane@example.com")));
  }

  @Test
  void aSignUpWithAnotherEmailIsNotTheCallersOwn() {
    SecurityContext caller = callerWith(new CatalogPrincipal("jane", "jane@example.com"));

    assertFalse(UserResource.isOwnSignUp(caller, user("jane", "admin@example.com")));
  }

  @Test
  void aSignUpWithAnotherNameIsNotTheCallersOwn() {
    SecurityContext caller = callerWith(new CatalogPrincipal("jane", "jane@example.com"));

    assertFalse(UserResource.isOwnSignUp(caller, user("john", "jane@example.com")));
  }

  @Test
  void aCallerWithoutATokenEmailCannotSignUp() {
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn("jane");

    assertFalse(UserResource.isOwnSignUp(callerWith(principal), user("jane", "jane@example.com")));
  }

  private static SecurityContext callerWith(Principal principal) {
    SecurityContext securityContext = mock(SecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    return securityContext;
  }

  private static User user(String name, String email) {
    return new User().withName(name).withEmail(email);
  }
}
