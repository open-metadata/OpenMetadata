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

package org.openmetadata.service.resources.context;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Who may start or retry a document's extraction: its owners, owning teams' members, admins. */
class MemoryExtractionAccessTest {
  private static final EntityReference ALICE = reference(Entity.USER, "alice");
  private static final EntityReference FINANCE = reference(Entity.TEAM, "finance");

  @Test
  void anOwnerMayExtract() {
    assertDoesNotThrow(() -> request(owned(ALICE), new User().withName("alice")));
  }

  @Test
  void aMemberOfAnOwningTeamMayExtract() {
    User member = new User().withName("bob").withTeams(List.of(FINANCE));

    assertDoesNotThrow(() -> request(owned(FINANCE), member));
  }

  @Test
  void anAdminMayExtractADocumentSomeoneElseOwns() {
    assertDoesNotThrow(() -> request(owned(ALICE), new User().withName("root").withIsAdmin(true)));
  }

  @Test
  void anyoneElseIsRefused() {
    assertRefused(() -> request(owned(ALICE), new User().withName("bob")));
  }

  /** A user named like the owning team is not one of its members. */
  @Test
  void aUserNamedLikeTheOwningTeamIsRefused() {
    assertRefused(() -> request(owned(FINANCE), new User().withName("finance")));
  }

  @Test
  void onlyAnAdminMayExtractADocumentNobodyOwns() {
    assertRefused(() -> request(new ContextFile(), new User().withName("bob")));
    assertDoesNotThrow(
        () -> request(new ContextFile(), new User().withName("root").withIsAdmin(true)));
  }

  private static void assertRefused(Executable request) {
    ForbiddenException refused = assertThrows(ForbiddenException.class, request);

    assertEquals(MemoryExtractionAccess.OWNERS_OR_ADMINS, refused.getMessage());
  }

  private static void request(ContextFile document, User caller) {
    SecurityContext securityContext = Mockito.mock(SecurityContext.class);
    try (MockedStatic<DefaultAuthorizer> authorizer = Mockito.mockStatic(DefaultAuthorizer.class)) {
      authorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(new SubjectContext(caller, null, null));
      MemoryExtractionAccess.requireOwnerOrAdmin(document, securityContext);
    }
  }

  private static ContextFile owned(EntityReference owner) {
    return new ContextFile().withOwners(List.of(owner));
  }

  private static EntityReference reference(String type, String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type).withName(name);
  }
}
