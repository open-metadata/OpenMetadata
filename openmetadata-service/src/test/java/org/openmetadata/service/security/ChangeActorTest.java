package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

class ChangeActorTest {

  @AfterEach
  void clearImpersonation() {
    ImpersonationContext.clear();
  }

  @Test
  void aRequestIsAUserWriteCarryingItsImpersonation() {
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn("steward");
    SecurityContext securityContext = mock(SecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    ImpersonationContext.setImpersonatedBy("agent-bot");

    ChangeActor actor = ChangeActor.fromRequest(securityContext);

    assertEquals(ChangeActor.user("steward", "agent-bot"), actor);
    assertFalse(actor.system());
  }

  @Test
  void aWriteRecordedUnderTheSystemAuthorIsASystemWrite() {
    assertTrue(ChangeActor.recorded(Entity.ADMIN_USER_NAME, null).system());
    assertTrue(ChangeActor.recorded("Admin", null).system());
  }

  @Test
  void aWriteRecordedUnderAnyOtherUserIsTheirs() {
    assertFalse(ChangeActor.recorded("steward", null).system());
    assertFalse(ChangeActor.recorded("governance-bot", null).system());
  }

  @Test
  void aNameThatOnlyUpperCaseFoldingMatchesToAdminIsNotTheSystemAuthor() {
    assertFalse(ChangeActor.recorded("admın", null).system());
  }

  @Test
  void aSystemWriteKeepsTheNamesItRecords() {
    ChangeActor actor = ChangeActor.system("steward", "governance-bot");

    assertTrue(actor.system());
    assertEquals("steward", actor.userName());
    assertEquals("governance-bot", actor.impersonatedBy());
  }
}
