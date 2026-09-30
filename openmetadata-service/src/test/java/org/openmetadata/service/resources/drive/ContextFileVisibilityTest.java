package org.openmetadata.service.resources.drive;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class ContextFileVisibilityTest {

  private static final String ALICE = "alice";
  private static final String BOB = "bob";
  private static final String BEFORE = "before-cursor";
  private static final String AFTER = "after-cursor";
  private static final int TOTAL = 7;

  @Test
  void aFilteredPageKeepsItsCursorsAndTotal() {
    ResultList<ContextFile> page =
        new ResultList<>(
            List.of(fileOwnedBy(ALICE, MemoryVisibility.PRIVATE), fileOwnedBy(BOB, null)),
            BEFORE,
            AFTER,
            TOTAL);

    ResultList<ContextFile> visible = visibleTo(BOB, false, page);

    assertEquals(1, visible.getData().size());
    assertEquals(BOB, visible.getData().getFirst().getOwners().getFirst().getName());
    assertNotNull(page.getPaging().getAfter());
    assertEquals(page.getPaging().getBefore(), visible.getPaging().getBefore());
    assertEquals(page.getPaging().getAfter(), visible.getPaging().getAfter());
    assertEquals(TOTAL, visible.getPaging().getTotal());
  }

  @Test
  void anAdminSeesTheWholePageWithItsCursors() {
    ResultList<ContextFile> page =
        new ResultList<>(
            List.of(fileOwnedBy(ALICE, MemoryVisibility.PRIVATE)), BEFORE, AFTER, TOTAL);

    ResultList<ContextFile> visible = visibleTo(BOB, true, page);

    assertEquals(1, visible.getData().size());
    assertEquals(page.getPaging().getAfter(), visible.getPaging().getAfter());
  }

  private static ResultList<ContextFile> visibleTo(
      String userName, boolean admin, ResultList<ContextFile> page) {
    SecurityContext securityContext = securityContextFor(userName);
    try (MockedStatic<DefaultAuthorizer> authorizer = Mockito.mockStatic(DefaultAuthorizer.class)) {
      authorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(
              new SubjectContext(new User().withName(userName).withIsAdmin(admin), null, null));
      return ContextFileVisibility.filterByVisibility(page, securityContext);
    }
  }

  private static ContextFile fileOwnedBy(String owner, MemoryVisibility visibility) {
    ContextFile file = new ContextFile().withOwners(List.of(new EntityReference().withName(owner)));
    return visibility == null
        ? file
        : file.withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }

  private static SecurityContext securityContextFor(String userName) {
    Principal principal = Mockito.mock(Principal.class);
    Mockito.when(principal.getName()).thenReturn(userName);
    SecurityContext securityContext = Mockito.mock(SecurityContext.class);
    Mockito.when(securityContext.getUserPrincipal()).thenReturn(principal);
    return securityContext;
  }
}
